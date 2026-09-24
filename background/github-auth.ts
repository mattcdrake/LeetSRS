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
let generation = 0;
let signingIn: Promise<void> | undefined;
let refreshing: Promise<z.infer<typeof authorizationSchema>> | undefined;
let error: GithubAuthStatus['error'] = null;

export function authGeneration() {
  return generation;
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

async function exchange(path: string, payload: Record<string, string>) {
  const response = await fetch(`${AUTH_ORIGIN}/${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
    cache: 'no-store',
    credentials: 'omit',
    signal: AbortSignal.timeout(20000),
  });
  if (!response.ok) throw new GithubAuthorizationError('GitHub authorization failed');
  const token = tokenSchema.parse(await response.json());
  const accountResponse = await fetch('https://api.github.com/user', {
    headers: { Authorization: `Bearer ${token.access_token}`, Accept: 'application/vnd.github+json' },
    cache: 'no-store',
    credentials: 'omit',
    signal: AbortSignal.timeout(20000),
  });
  if (!accountResponse.ok) throw new GithubAuthorizationError('GitHub account validation failed');
  return {
    account: accountSchema.parse(await accountResponse.json()),
    accessToken: token.access_token,
    refreshToken: token.refresh_token,
    expiresAt: Date.now() + token.expires_in * 1000,
    refreshExpiresAt: Date.now() + token.refresh_token_expires_in * 1000,
  };
}

// Serialize permission events, requests, and cancellation so one grant launches one flow.
function updateSignInRequest(run: (expected: number) => Promise<void>): Promise<void> {
  const expected = generation;
  const result = signInRequests.then(async () => {
    if (expected === generation) await run(expected);
  });
  signInRequests = result.catch(() => {});
  return result;
}

async function resumeSignInRequest(expected: number) {
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
  if (expected === generation) launchGithubSignIn();
}

export function startGithubSignIn(): Promise<void> {
  return updateSignInRequest(async (expected) => {
    if (signingIn || (await readAuthorization())) return;
    error = null;
    await signInRequestItem.setValue(Date.now() + SIGN_IN_REQUEST_TTL);
    // Also covers grants that arrive before the command has finished arming.
    await resumeSignInRequest(expected);
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
  const expected = generation;
  error = null;
  const attempt = (async () => {
    if (!(await browser.permissions.contains(GITHUB_HOST_PERMISSIONS))) throw new Error('GitHub access required');
    // Changing accounts requires signing out first.
    if (await readAuthorization()) return;
    if (expected !== generation) return;
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
    if (!code || expected !== generation) throw new Error('Sign-in cancelled');
    const auth = await exchange('exchange', { code, code_verifier: verifier, redirect_uri: redirectUri });
    if (expected !== generation) return;
    await storage.setItems([
      { item: githubAuthorizationItem, value: auth },
      { item: githubSetupPendingItem, value: true },
    ]);
  })()
    .catch(() => {
      if (expected === generation) error = 'signInFailed';
    })
    .finally(() => {
      if (signingIn === attempt) signingIn = undefined;
    });
  signingIn = attempt;
}

export async function getGithubAuthorization() {
  const expected = generation;
  if (!(await browser.permissions.contains(GITHUB_HOST_PERMISSIONS)))
    throw new GithubAuthorizationError('Enable GitHub access in Settings');
  const saved = await readAuthorization();
  if (!saved || expected !== generation) throw new GithubAuthorizationError('Sign in with GitHub');
  if (saved.expiresAt > Date.now() + 60000) return saved;
  if (saved.refreshExpiresAt <= Date.now()) throw new GithubAuthorizationError('Sign in with GitHub');
  if (refreshing) return refreshing;
  const attempt = (async () => {
    const auth = await exchange('refresh', { refresh_token: saved.refreshToken });
    if (auth.account.id !== saved.account.id) throw new GithubAuthorizationError('GitHub account changed');
    if (expected !== generation) throw new GithubAuthorizationError('authorization changed');
    await githubAuthorizationItem.setValue(auth);
    if (expected !== generation) throw new GithubAuthorizationError('authorization changed');
    return auth;
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
  generation++;
  signingIn = undefined;
  refreshing = undefined;
  error = null;
  await signInRequests;
  await signInRequestItem.removeValue();
  await storage.removeItems([githubAuthorizationItem, githubSetupPendingItem]);
}
