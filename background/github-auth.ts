import { browser } from 'wxt/browser';
import { z } from 'zod';
import { storage } from '#imports';
import { readPatMigration } from '@/background/legacy/github-pat';
import type { GithubAuthStatus } from '@/shared/github-auth';

const AUTH_KEY = 'local:leetsrs:githubAuthorization';
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
let credentialWrite = Promise.resolve();

export function authGeneration() {
  return generation;
}

async function readAuthorization() {
  const value = await storage.getItem(AUTH_KEY);
  return value == null ? null : authorizationSchema.parse(value);
}

export async function getGithubAuthStatus(): Promise<GithubAuthStatus> {
  const auth = await readAuthorization();
  const migration = await readPatMigration();
  return { account: auth?.account ?? null, signingIn: !!signingIn, error, migrationNotice: migration.notice };
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
  if (!response.ok) throw new Error('401: GitHub authorization failed');
  const token = tokenSchema.parse(await response.json());
  const accountResponse = await fetch('https://api.github.com/user', {
    headers: { Authorization: `Bearer ${token.access_token}`, Accept: 'application/vnd.github+json' },
    cache: 'no-store',
    credentials: 'omit',
    signal: AbortSignal.timeout(20000),
  });
  if (!accountResponse.ok) throw new Error('401: GitHub account validation failed');
  return {
    account: accountSchema.parse(await accountResponse.json()),
    accessToken: token.access_token,
    refreshToken: token.refresh_token,
    expiresAt: Date.now() + token.expires_in * 1000,
    refreshExpiresAt: Date.now() + token.refresh_token_expires_in * 1000,
  };
}

export function startGithubSignIn(): void {
  if (signingIn) return;
  const expected = generation;
  error = null;
  const attempt = (async () => {
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
    credentialWrite = storage.setItem(AUTH_KEY, auth);
    await credentialWrite;
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
  const saved = await readAuthorization();
  if (!saved || expected !== generation) throw new Error('401: Sign in with GitHub');
  if (saved.expiresAt > Date.now() + 60000) return saved;
  if (saved.refreshExpiresAt <= Date.now()) throw new Error('401: Sign in with GitHub');
  if (refreshing) return refreshing;
  const attempt = (async () => {
    const auth = await exchange('refresh', { refresh_token: saved.refreshToken });
    if (auth.account.id !== saved.account.id) throw new Error('401: GitHub account changed');
    if (expected !== generation) throw new Error('401: authorization changed');
    credentialWrite = storage.setItem(AUTH_KEY, auth);
    await credentialWrite;
    if (expected !== generation) throw new Error('401: authorization changed');
    return auth;
  })();
  refreshing = attempt;
  try {
    return await attempt;
  } finally {
    if (refreshing === attempt) refreshing = undefined;
  }
}

export async function signOutGithub(): Promise<void> {
  generation++;
  signingIn = undefined;
  refreshing = undefined;
  error = null;
  // Wait for an already-started storage write, never an OAuth/network request.
  await credentialWrite.catch(() => {});
  await storage.removeItem(AUTH_KEY);
}
