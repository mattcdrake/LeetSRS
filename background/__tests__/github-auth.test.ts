import { beforeEach, expect, it, vi } from 'vitest';
import { browser } from 'wxt/browser';
import { fakeBrowser } from 'wxt/testing/fake-browser';
import { storage } from '#imports';
import {
  getGithubAuthorization,
  getGithubAuthStatus,
  signOutGithub,
  startGithubSignIn,
} from '@/background/github-auth';
import { readGistConnection } from '@/shared/storage';
import { seedGithubAuthorization } from '@/test/utils/github-auth';

const token = {
  access_token: 'access',
  refresh_token: 'rotated',
  expires_in: 28800,
  refresh_token_expires_in: 15897600,
  token_type: 'bearer',
  scope: 'gist',
};
const callback = 'https://aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa.chromiumapp.org/';
beforeEach(async () => {
  fakeBrowser.reset();
  vi.spyOn(browser.permissions, 'contains').mockImplementation(async () => true);
  await signOutGithub();
  vi.stubEnv('WXT_GITHUB_CLIENT_ID', 'client');
  vi.spyOn(browser.identity, 'getRedirectURL').mockReturnValue(callback);
  vi.spyOn(globalThis, 'fetch').mockImplementation(async (url) =>
    Response.json(String(url).endsWith('/user') ? { id: 1, login: 'tester' } : token)
  );
});
async function finishSignIn() {
  await vi.waitFor(async () => expect((await getGithubAuthStatus()).signingIn).toBe(false));
}
function acceptSignIn() {
  vi.spyOn(browser.identity, 'launchWebAuthFlow').mockImplementation(
    async ({ url }) => `${callback}?code=code&state=${new URL(url).searchParams.get('state')}`
  );
}
it('validates state and uses PKCE, saves credentials locally, and does not enable sync', async () => {
  acceptSignIn();
  startGithubSignIn();
  await finishSignIn();
  expect(await getGithubAuthStatus()).toMatchObject({ account: { id: 1, login: 'tester' }, error: null });
  expect(await readGistConnection()).toEqual({ accountId: null, gistId: null, enabled: false });
  expect(await fakeBrowser.storage.sync.get()).toEqual({});
  const request = vi.mocked(browser.identity.launchWebAuthFlow).mock.calls[0][0];
  const url = new URL(request.url);
  expect(url.searchParams.get('scope')).toBe('gist offline_access');
  expect(url.searchParams.get('code_challenge_method')).toBe('S256');
  expect(url.searchParams.get('code_challenge')).toHaveLength(43);
  expect(JSON.stringify(await getGithubAuthStatus())).not.toMatch(/access|rotated/);
});
it.each(['state', 'origin', 'cancel', 'exchange', 'account'])(
  'handles %s failure without saving authorization',
  async (failure) => {
    acceptSignIn();
    if (failure === 'state')
      vi.mocked(browser.identity.launchWebAuthFlow).mockImplementation(async () => `${callback}?code=code&state=wrong`);
    if (failure === 'origin')
      vi.mocked(browser.identity.launchWebAuthFlow).mockImplementation(async () => 'https://evil.example/?code=code');
    if (failure === 'cancel') vi.mocked(browser.identity.launchWebAuthFlow).mockRejectedValue(new Error('Cancelled'));
    if (failure === 'exchange') vi.mocked(fetch).mockResolvedValue(new Response('', { status: 400 }));
    if (failure === 'account')
      vi.mocked(fetch)
        .mockResolvedValueOnce(Response.json(token))
        .mockResolvedValueOnce(Response.json({ id: 'invalid' }));
    startGithubSignIn();
    await finishSignIn();
    expect(await getGithubAuthStatus()).toMatchObject({ account: null, error: 'signInFailed' });
    if (['state', 'origin', 'cancel'].includes(failure)) expect(fetch).not.toHaveBeenCalled();
  }
);
it('shares concurrent refreshes and persists rotated credentials before returning', async () => {
  await seedGithubAuthorization();
  const saved = await storage.getItem<Record<string, unknown>>('local:leetsrs:githubAuthorization');
  await storage.setItem('local:leetsrs:githubAuthorization', { ...saved, expiresAt: 0 });
  const results = await Promise.all([getGithubAuthorization(), getGithubAuthorization(), getGithubAuthorization()]);
  expect(fetch).toHaveBeenCalledTimes(2);
  expect(results.map((result) => result.refreshToken)).toEqual(['rotated', 'rotated', 'rotated']);
  expect(await storage.getItem('local:leetsrs:githubAuthorization')).toMatchObject({ refreshToken: 'rotated' });
});
it.each(['sign-in', 'refresh'])('does not restore authorization when %s finishes after sign-out', async (operation) => {
  const pending = Promise.withResolvers<Response>();
  vi.mocked(fetch).mockReturnValueOnce(pending.promise);
  let refresh: Promise<unknown> | undefined;
  if (operation === 'sign-in') {
    acceptSignIn();
    startGithubSignIn();
  } else {
    await seedGithubAuthorization();
    const saved = await storage.getItem<Record<string, unknown>>('local:leetsrs:githubAuthorization');
    await storage.setItem('local:leetsrs:githubAuthorization', { ...saved, expiresAt: 0 });
    refresh = getGithubAuthorization().catch(() => null);
  }
  await vi.waitFor(() => expect(fetch).toHaveBeenCalledOnce());
  await signOutGithub();
  pending.resolve(Response.json(token));
  if (refresh) await refresh;
  else await vi.waitFor(() => expect(fetch).toHaveBeenCalledTimes(2));
  expect((await getGithubAuthStatus()).account).toBeNull();
  expect((await readGistConnection()).enabled).toBe(false);
});
it('keeps saved authorization unchanged on refresh failure and allows retry', async () => {
  await seedGithubAuthorization();
  const saved = await storage.getItem<Record<string, unknown>>('local:leetsrs:githubAuthorization');
  const expired = { ...saved, expiresAt: 0 };
  await storage.setItem('local:leetsrs:githubAuthorization', expired);
  vi.mocked(fetch).mockRejectedValueOnce(new Error('Offline'));
  await expect(getGithubAuthorization()).rejects.toThrow();
  expect(await storage.getItem('local:leetsrs:githubAuthorization')).toEqual(expired);
  expect((await getGithubAuthorization()).refreshToken).toBe('rotated');
});

it('requires sign-out before starting another account sign-in', async () => {
  await seedGithubAuthorization();
  acceptSignIn();
  startGithubSignIn();
  await finishSignIn();
  expect(browser.identity.launchWebAuthFlow).not.toHaveBeenCalled();
  expect((await getGithubAuthStatus()).account?.login).toBe('tester');
  await signOutGithub();
  startGithubSignIn();
  await finishSignIn();
  expect(browser.identity.launchWebAuthFlow).toHaveBeenCalledOnce();
});

it.each(['sign-in', 'refresh'])('sign-out waits for a %s credential write already in progress', async (operation) => {
  if (operation === 'refresh') {
    await seedGithubAuthorization();
    const saved = await storage.getItem<Record<string, unknown>>('local:leetsrs:githubAuthorization');
    await storage.setItem('local:leetsrs:githubAuthorization', { ...saved, expiresAt: 0 });
  }
  const started = Promise.withResolvers<void>();
  const release = Promise.withResolvers<void>();
  const write = fakeBrowser.storage.local.set.bind(fakeBrowser.storage.local);
  vi.spyOn(fakeBrowser.storage.local, 'set').mockImplementationOnce(async (items) => {
    started.resolve();
    await release.promise;
    await write(items);
  });
  let refresh: Promise<unknown> | undefined;
  if (operation === 'sign-in') {
    acceptSignIn();
    startGithubSignIn();
  } else refresh = getGithubAuthorization().catch(() => null);
  await started.promise;
  const signingOut = signOutGithub();
  release.resolve();
  await signingOut;
  await refresh;
  expect((await getGithubAuthStatus()).account).toBeNull();
  expect(await storage.getItem('local:leetsrs:githubAuthorization')).toBeNull();
});

it('refuses OAuth without host access', async () => {
  vi.mocked(browser.permissions.contains).mockImplementation(async () => false);
  acceptSignIn();
  startGithubSignIn();
  await finishSignIn();
  expect(browser.identity.launchWebAuthFlow).not.toHaveBeenCalled();
  expect(fetch).not.toHaveBeenCalled();
  expect((await getGithubAuthStatus()).error).toBe('signInFailed');
});

it('blocks saved authorization after revocation and preserves it for re-enabling', async () => {
  await seedGithubAuthorization();
  vi.mocked(browser.permissions.contains).mockImplementation(async () => false);
  await expect(getGithubAuthorization()).rejects.toThrow('Enable GitHub access');
  expect(fetch).not.toHaveBeenCalled();
  expect((await getGithubAuthStatus()).account?.login).toBe('tester');
  vi.mocked(browser.permissions.contains).mockImplementation(async () => true);
  expect((await getGithubAuthorization()).account.login).toBe('tester');
});
