import { browser } from 'wxt/browser';
import { z } from 'zod';
import { storage } from '#imports';
import { readPatMigration } from '@/background/legacy/github-pat';
import {
  GITHUB_HOST_PERMISSIONS,
  type GithubAuthStatus,
  githubAuthorizationItem,
  githubSetupPendingItem,
} from '@/shared/gist-sync';

export class GithubAuthorizationError extends Error {
  readonly code = 'authentication';
}

const signInRequestItem = storage.defineItem<unknown>('session:leetsrs:githubSignInRequest');
const SIGN_IN_REQUEST_TTL = 5 * 60 * 1000;
let signInRequests = Promise.resolve();

const AUTH_ORIGIN = 'https://auth.leetsrs.com';
const accountSchema = z.object({ id: z.number().int().positive(), login: z.string().min(1) });
const tokenSchema = z.object({
  access_token: z.string().min(1),
  refresh_token: z.string().min(1),
  expires_in: z.number().positive(),
  refresh_token_expires_in: z.number().positive(),
  token_type: z.literal('bearer'),
  scope: z.string().refine((scope) => scope.split(/[ ,]+/).includes('gist')),
});
const authorizationSchema = z.object({
  account: accountSchema,
  accessToken: z.string().min(1),
  refreshToken: z.string().min(1),
  expiresAt: z.number(),
  refreshExpiresAt: z.number(),
});
let authorizationAbort = new AbortController();
let signingIn: Promise<void> | undefined;
let refreshing: Promise<z.infer<typeof authorizationSchema>> | undefined;
let error: GithubAuthStatus['error'] = null;

// Aborted when the authorization is cleared, so work started under it stops before writing results.
export function authorizationSignal(): AbortSignal {
  return authorizationAbort.signal;
}

async function readAuthorization() {
  const value = await githubAuthorizationItem.getValue();
  return value == null ? null : authorizationSchema.parse(value);
}

export async function getGithubAuthStatus(): Promise<GithubAuthStatus> {
  const auth = await readAuthorization();
  const migration = await readPatMigration();
  return {
    account: auth?.account ?? null,
    signingIn: !!signingIn,
    error,
    migrationNotice: migration.notice,
    setupPending: !!auth && (await githubSetupPendingItem.getValue()),
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
  return tokenSchema.parse(await response.json());
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

function toAuthorization(account: z.infer<typeof accountSchema>, token: z.infer<typeof tokenSchema>) {
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

async function resumeSignInRequest(signal: AbortSignal) {
  const expiresAt = z
    .number()
    .finite()
    .nullable()
    .parse(await signInRequestItem.getValue());
  if (expiresAt === null) return;
  if (expiresAt <= Date.now()) {
    await signInRequestItem.removeValue();
    return;
  }
  if (!(await browser.permissions.contains(GITHUB_HOST_PERMISSIONS))) return;
  await signInRequestItem.removeValue();
  if (!signal.aborted) launchGithubSignIn();
}

export function startGithubSignIn(): Promise<void> {
  return updateSignInRequest(async (signal) => {
    if (signingIn || (await readAuthorization())) return;
    error = null;
    await signInRequestItem.setValue(Date.now() + SIGN_IN_REQUEST_TTL);
    // Also covers grants that arrive before the command has finished arming.
    await resumeSignInRequest(signal);
  });
}

export function resumeGithubSignIn(): Promise<void> {
  return updateSignInRequest(resumeSignInRequest);
}

export function cancelGithubSignInRequest(): Promise<void> {
  return updateSignInRequest(async () => {
    await signInRequestItem.removeValue();
  });
}

function launchGithubSignIn(): void {
  if (signingIn) return;
  const signal = authorizationAbort.signal;
  error = null;
  const attempt = (async () => {
    if (!(await browser.permissions.contains(GITHUB_HOST_PERMISSIONS))) throw new Error('GitHub access required');
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
  })()
    .catch(() => {
      if (!signal.aborted) error = 'signInFailed';
    })
    .finally(() => {
      if (signingIn === attempt) signingIn = undefined;
    });
  signingIn = attempt;
}

export async function getGithubAuthorization() {
  const signal = authorizationAbort.signal;
  if (!(await browser.permissions.contains(GITHUB_HOST_PERMISSIONS)))
    throw new GithubAuthorizationError('Enable GitHub access in Settings');
  const saved = await readAuthorization();
  if (!saved || signal.aborted) throw new GithubAuthorizationError('Sign in with GitHub');
  if (saved.expiresAt > Date.now() + 60000) return saved;
  if (saved.refreshExpiresAt <= Date.now()) throw new GithubAuthorizationError('Sign in with GitHub');
  if (refreshing) return refreshing;
  const attempt = (async () => {
    let token: z.infer<typeof tokenSchema>;
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
  })();
  refreshing = attempt;
  try {
    return await attempt;
  } finally {
    if (refreshing === attempt) refreshing = undefined;
  }
}

export async function dismissGithubSetupPrompt(): Promise<void> {
  await githubSetupPendingItem.removeValue();
}

export async function clearGithubAuthorization(): Promise<void> {
  authorizationAbort.abort(new GithubAuthorizationError('authorization changed'));
  authorizationAbort = new AbortController();
  signingIn = undefined;
  refreshing = undefined;
  error = null;
  await signInRequests;
  await signInRequestItem.removeValue();
  await storage.removeItems([githubAuthorizationItem, githubSetupPendingItem]);
}
