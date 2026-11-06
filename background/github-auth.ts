import { browser } from 'wxt/browser';
import { z } from 'zod';
import { storage } from '#imports';
import {
  GITHUB_PERMISSIONS,
  type GithubAuthStatus,
  githubAuthorizationItem,
  githubSetupPendingItem,
} from '@/shared/gist-sync';
import { githubTokenSchema } from '@/shared/github-token';

export class GithubAuthorizationError extends Error {
  readonly code = 'authentication';
}

const signInRequestItem = storage.defineItem<unknown>('session:leetsrs:githubSignInRequest');
const SIGN_IN_REQUEST_TTL = 5 * 60 * 1000;
let signInRequests = Promise.resolve();

const AUTH_ORIGIN = 'https://auth.leetsrs.com';
const accountSchema = z.object({ id: z.number().int().positive(), login: z.string().min(1) });
const authorizationSchema = z.object({
  account: accountSchema,
  accessToken: z.string().min(1),
  refreshToken: z.string().min(1),
  expiresAt: z.number(),
  refreshExpiresAt: z.number(),
});
type Authorization = z.infer<typeof authorizationSchema>;

// GitHub sign-in moves through these phases:
//
//   signedOut ──start──▶ awaitingGrant ──grant──▶ signingIn ──success──▶ signedIn ◀──▶ refreshing
//      ▲  ▲                    │                      │                                   │
//      │  └── cancel/expire ───┘                      │                                   │
//      ├───────────── failure (signInFailed) ─────────┘                                   │
//      └──────────────────── clear: sign-out, rejected refresh, account change ───────────┘
//
// awaitingGrant and signedIn are stored, so they survive service worker restarts.
// signingIn and refreshing are attempts running in this worker.
type GithubAuthState =
  | { phase: 'signedOut'; error: GithubAuthStatus['error'] }
  | { phase: 'awaitingGrant' }
  | { phase: 'signingIn' }
  | { phase: 'signedIn'; authorization: Authorization }
  | { phase: 'refreshing'; authorization: Authorization };

// The part of the state only this worker holds. Transitions on it are synchronous,
// so callers check it again after every await rather than trusting an earlier read.
type Attempt =
  | { phase: 'idle'; error: GithubAuthStatus['error'] }
  | { phase: 'signingIn'; done: Promise<void> }
  | { phase: 'refreshing'; done: Promise<Authorization> };

const IDLE: Attempt = { phase: 'idle', error: null };
let attempt: Attempt = IDLE;

// Aborted on every clear, so work started under the old authorization stops before writing results.
let authorizationAbort = new AbortController();

export function authorizationSignal(): AbortSignal {
  return authorizationAbort.signal;
}

// Ends an attempt unless a clear or a newer attempt has already replaced it.
function settle(done: Promise<unknown>, next: Attempt): void {
  if (attempt.phase !== 'idle' && attempt.done === done) attempt = next;
}

async function readAuthorization(): Promise<Authorization | null> {
  const value = await githubAuthorizationItem.getValue();
  return value == null ? null : authorizationSchema.parse(value);
}

async function readSignInRequest(): Promise<number | null> {
  return z
    .number()
    .finite()
    .nullable()
    .parse(await signInRequestItem.getValue());
}

async function readState(): Promise<GithubAuthState> {
  const authorization = await readAuthorization();
  if (authorization) {
    return { phase: attempt.phase === 'refreshing' ? 'refreshing' : 'signedIn', authorization };
  }
  if (attempt.phase === 'signingIn') return { phase: 'signingIn' };
  const expiresAt = await readSignInRequest();
  if (expiresAt !== null && expiresAt > Date.now()) return { phase: 'awaitingGrant' };
  return { phase: 'signedOut', error: attempt.phase === 'idle' ? attempt.error : null };
}

export async function getGithubAuthStatus(): Promise<GithubAuthStatus> {
  const state = await readState();
  const account = state.phase === 'signedIn' || state.phase === 'refreshing' ? state.authorization.account : null;
  return {
    account,
    signingIn: state.phase === 'signingIn',
    error: state.phase === 'signedOut' ? state.error : null,
    setupPending: account !== null && (await githubSetupPendingItem.getValue()),
  };
}

function base64url(bytes: Uint8Array): string {
  return btoa(String.fromCharCode(...bytes))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}

// The auth worker answers 400 when GitHub rejects the code or refresh token; retrying cannot succeed.
class RejectedAuthorizationError extends GithubAuthorizationError {}

async function requestTokens(path: 'exchange' | 'refresh', payload: Record<string, string>) {
  const response = await fetch(`${AUTH_ORIGIN}/${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
    cache: 'no-store',
    credentials: 'omit',
    signal: AbortSignal.timeout(20000),
  });
  if (response.status === 400) throw new RejectedAuthorizationError('GitHub rejected the authorization');
  if (!response.ok) throw new GithubAuthorizationError('GitHub authorization failed');
  return githubTokenSchema.parse(await response.json());
}

async function fetchAccount(accessToken: string) {
  const response = await fetch('https://api.github.com/user', {
    headers: { Authorization: `Bearer ${accessToken}`, Accept: 'application/vnd.github+json' },
    cache: 'no-store',
    credentials: 'omit',
    signal: AbortSignal.timeout(20000),
  });
  if (!response.ok) throw new GithubAuthorizationError('GitHub account validation failed');
  return accountSchema.parse(await response.json());
}

function toAuthorization(account: z.infer<typeof accountSchema>, token: z.infer<typeof githubTokenSchema>) {
  return {
    account,
    accessToken: token.access_token,
    refreshToken: token.refresh_token,
    expiresAt: Date.now() + token.expires_in * 1000,
    refreshExpiresAt: Date.now() + token.refresh_token_expires_in * 1000,
  };
}

// Serialize permission events, requests, and cancellation so one grant launches one flow.
function updateSignInRequest(run: (signal: AbortSignal) => Promise<void>): Promise<void> {
  const signal = authorizationAbort.signal;
  const result = signInRequests.then(async () => {
    if (!signal.aborted) await run(signal);
  });
  signInRequests = result.catch(() => {});
  return result;
}

// awaitingGrant → signingIn once the permission is granted; an expired request returns to signedOut.
async function resumeSignInRequest(signal: AbortSignal) {
  const state = await readState();
  if (state.phase !== 'awaitingGrant') {
    await signInRequestItem.removeValue();
    return;
  }
  if (!(await browser.permissions.contains(GITHUB_PERMISSIONS))) return;
  await signInRequestItem.removeValue();
  if (!signal.aborted) launchGithubSignIn();
}

// signedOut → awaitingGrant. Also covers grants that arrive before the request has finished arming.
export function startGithubSignIn(): Promise<void> {
  return updateSignInRequest(async (signal) => {
    const { phase } = await readState();
    if (phase !== 'signedOut' && phase !== 'awaitingGrant') return;
    attempt = IDLE;
    await signInRequestItem.setValue(Date.now() + SIGN_IN_REQUEST_TTL);
    await resumeSignInRequest(signal);
  });
}

export function resumeGithubSignIn(): Promise<void> {
  return updateSignInRequest(resumeSignInRequest);
}

// awaitingGrant → signedOut when the permission prompt is denied.
export function cancelGithubSignInRequest(): Promise<void> {
  return updateSignInRequest(async () => {
    await signInRequestItem.removeValue();
  });
}

// → signingIn → signedIn, or back to signedOut with signInFailed.
function launchGithubSignIn(): void {
  if (attempt.phase !== 'idle') return;
  const signal = authorizationAbort.signal;
  const done = (async () => {
    if (!(await browser.permissions.contains(GITHUB_PERMISSIONS))) throw new Error('GitHub access required');
    // Changing accounts requires signing out first.
    if (await readAuthorization()) return;
    if (signal.aborted) return;
    const clientId = import.meta.env.WXT_GITHUB_CLIENT_ID;
    if (!clientId) throw new Error('OAuth client is not configured');
    const redirectUri = browser.identity.getRedirectURL();
    const state = base64url(crypto.getRandomValues(new Uint8Array(32)));
    const verifier = base64url(crypto.getRandomValues(new Uint8Array(32)));
    const challenge = base64url(
      new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(verifier)))
    );
    const url = new URL('https://github.com/login/oauth/authorize');
    url.search = new URLSearchParams({
      client_id: clientId,
      redirect_uri: redirectUri,
      scope: 'gist offline_access',
      state,
      code_challenge: challenge,
      code_challenge_method: 'S256',
    }).toString();
    const result = await browser.identity.launchWebAuthFlow({ url: url.href, interactive: true });
    if (!result) throw new Error('Sign-in cancelled');
    const callback = new URL(result);
    const expectedCallback = new URL(redirectUri);
    if (
      callback.origin !== expectedCallback.origin ||
      callback.pathname !== expectedCallback.pathname ||
      callback.searchParams.get('state') !== state ||
      callback.searchParams.has('error')
    )
      throw new Error('Invalid OAuth callback');
    const code = callback.searchParams.get('code');
    if (!code || signal.aborted) throw new Error('Sign-in cancelled');
    const token = await requestTokens('exchange', { code, code_verifier: verifier, redirect_uri: redirectUri });
    const auth = toAuthorization(await fetchAccount(token.access_token), token);
    if (signal.aborted) return;
    await storage.setItems([
      { item: githubAuthorizationItem, value: auth },
      { item: githubSetupPendingItem, value: true },
    ]);
  })();
  attempt = { phase: 'signingIn', done };
  void done.then(
    () => settle(done, IDLE),
    () => settle(done, signal.aborted ? IDLE : { phase: 'idle', error: 'signInFailed' })
  );
}

// signedIn → refreshing → signedIn once the access token is close to expiry.
export async function getGithubAuthorization(): Promise<Authorization> {
  const signal = authorizationAbort.signal;
  if (!(await browser.permissions.contains(GITHUB_PERMISSIONS)))
    throw new GithubAuthorizationError('Enable GitHub access in Settings');
  const saved = await readAuthorization();
  if (!saved || signal.aborted) throw new GithubAuthorizationError('Sign in with GitHub');
  if (saved.expiresAt > Date.now() + 60000) return saved;
  if (saved.refreshExpiresAt <= Date.now()) throw new GithubAuthorizationError('Sign in with GitHub');
  if (attempt.phase === 'refreshing') return attempt.done;
  const done = refreshAuthorization(saved, signal);
  attempt = { phase: 'refreshing', done };
  try {
    return await done;
  } finally {
    settle(done, IDLE);
  }
}

async function refreshAuthorization(saved: Authorization, signal: AbortSignal): Promise<Authorization> {
  let token: z.infer<typeof githubTokenSchema>;
  try {
    token = await requestTokens('refresh', { refresh_token: saved.refreshToken });
  } catch (error) {
    // Sign out rather than retry a revoked or already-rotated refresh token on every sync.
    if (error instanceof RejectedAuthorizationError && !signal.aborted) await clearGithubAuthorization();
    throw error;
  }
  signal.throwIfAborted();
  // GitHub rotates the refresh token, so save it before the account check can fail.
  const auth = toAuthorization(saved.account, token);
  await githubAuthorizationItem.setValue(auth);
  signal.throwIfAborted();
  const account = await fetchAccount(auth.accessToken);
  if (account.id !== saved.account.id) {
    if (!signal.aborted) await clearGithubAuthorization();
    throw new GithubAuthorizationError('GitHub account changed');
  }
  signal.throwIfAborted();
  if (account.login === auth.account.login) return auth;
  // Keep a renamed login current in Settings.
  const renamed = { ...auth, account };
  await githubAuthorizationItem.setValue(renamed);
  signal.throwIfAborted();
  return renamed;
}

export async function dismissGithubSetupPrompt(): Promise<void> {
  await githubSetupPendingItem.removeValue();
}

// Any phase → signedOut.
export async function clearGithubAuthorization(): Promise<void> {
  authorizationAbort.abort(new GithubAuthorizationError('authorization changed'));
  authorizationAbort = new AbortController();
  attempt = IDLE;
  await signInRequests;
  await signInRequestItem.removeValue();
  await storage.removeItems([githubAuthorizationItem, githubSetupPendingItem]);
}
