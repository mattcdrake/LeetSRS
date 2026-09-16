/** @vitest-environment happy-dom */
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, expect, it, vi } from 'vitest';
import { browser } from 'wxt/browser';
import { storage } from '#imports';
import { background } from '@/shared/background-service';
import { replaceLearningDocument, STORAGE_KEYS } from '@/shared/storage';
import { buildLearningDocument } from '@/test/utils/learning-document-mocks';
import { createServiceMock } from '@/test/utils/service-mocks';
import { createPopupTestWrapper } from '@/test/utils/test-wrapper';
import { GistSyncSection } from '../GistSyncSection';

vi.mock('@/shared/background-service');
const service = createServiceMock(background);
const signedIn = {
  account: { id: 1, login: 'tester' },
  signingIn: false,
  error: null,
  migrationNotice: false,
  setupPending: false,
};
beforeEach(async () => {
  vi.spyOn(browser.permissions, 'contains').mockImplementation(async () => true);
  vi.spyOn(browser.permissions, 'request').mockImplementation(async () => true);
  for (const event of [browser.permissions.onAdded, browser.permissions.onRemoved]) {
    vi.spyOn(event, 'addListener').mockImplementation(() => {});
    vi.spyOn(event, 'removeListener').mockImplementation(() => {});
  }
  await replaceLearningDocument(buildLearningDocument());
  await storage.setItem(STORAGE_KEYS.gistConnection, { accountId: 1, gistId: 'saved', enabled: false });
  service
    .reset()
    .resolve('cancelGithubSignInRequest', undefined)
    .resolve('getGithubAuthStatus', signedIn)
    .resolve('getGistSyncStatus', {
      lastSyncTime: null,
      syncInProgress: false,
      lastError: null,
    })
    .resolve('listGistDestinations', [
      { id: 'backup', description: 'My backup', updatedAt: '2026-09-15', suggested: true },
    ])
    .resolve('setupGistSync', { saved: true })
    .resolve('setGistSyncEnabled', { saved: true });
});
function open() {
  return render(<GistSyncSection />, { wrapper: createPopupTestWrapper().wrapper });
}

it('shows cancellable sign-in progress without a stale error or duplicate sign-in button', async () => {
  service
    .resolve('getGithubAuthStatus', { ...signedIn, account: null, signingIn: true, error: 'signInFailed' })
    .resolve('signOutGithub', undefined);
  open();
  expect(await screen.findByRole('status')).toHaveTextContent('Signing in…');
  expect(screen.queryByRole('button', { name: 'Sign in with GitHub' })).not.toBeInTheDocument();
  expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
  await waitFor(() => expect(background.signOutGithub).toHaveBeenCalledOnce());
});

it('shows a concise sign-in error and clears it from view while retrying', async () => {
  const pending = Promise.withResolvers<void>();
  service
    .resolve('getGithubAuthStatus', { ...signedIn, account: null, error: 'signInFailed' })
    .resolve('startGithubSignIn', pending.promise);
  open();
  expect(await screen.findByRole('alert')).toHaveTextContent('Couldn’t sign in. Please try again.');
  fireEvent.click(screen.getByRole('button', { name: 'Sign in with GitHub' }));
  await waitFor(() => expect(screen.queryByRole('alert')).not.toBeInTheDocument());
  expect(screen.getByRole('status')).toHaveTextContent('Signing in…');
  await act(async () => pending.resolve());
});

it.each([false, true])(
  'requests hosts in the click gesture and waits for grant (existing access: %s)',
  async (granted) => {
    vi.mocked(browser.permissions.contains).mockImplementation(async () => granted);
    const pending = Promise.withResolvers<boolean>();
    vi.mocked(browser.permissions.request).mockImplementation(() => pending.promise);
    service.resolve('getGithubAuthStatus', { ...signedIn, account: null }).resolve('startGithubSignIn', undefined);
    open();
    const button = await screen.findByRole('button', { name: 'Sign in with GitHub' });
    await waitFor(() => expect(button).toBeEnabled());
    fireEvent.click(button);
    expect(browser.permissions.request).toHaveBeenCalledExactlyOnceWith({
      origins: ['https://auth.leetsrs.com/*', 'https://api.github.com/*', 'https://gist.githubusercontent.com/*'],
    });
    expect(background.startGithubSignIn).toHaveBeenCalledOnce();
    vi.mocked(browser.permissions.contains).mockImplementation(async () => true);
    await act(async () => pending.resolve(true));
    await waitFor(() => expect(background.startGithubSignIn).toHaveBeenCalledOnce());
  }
);

it.each(['denied', 'rejected', 'throws'])(
  'cancels pending sign-in and allows retry after permission request is %s',
  async (failure) => {
    vi.mocked(browser.permissions.contains).mockImplementation(async () => false);
    if (failure === 'denied') vi.mocked(browser.permissions.request).mockImplementationOnce(async () => false);
    else if (failure === 'rejected')
      vi.mocked(browser.permissions.request).mockRejectedValueOnce(new Error('Unavailable'));
    else
      vi.mocked(browser.permissions.request).mockImplementationOnce(() => {
        throw new Error('Unavailable');
      });
    service.resolve('getGithubAuthStatus', { ...signedIn, account: null }).resolve('startGithubSignIn', undefined);
    open();
    const button = await screen.findByRole('button', { name: 'Sign in with GitHub' });
    await waitFor(() => expect(button).toBeEnabled());
    fireEvent.click(button);
    expect(await screen.findByRole('alert')).toHaveTextContent('GitHub access wasn’t granted');
    expect(background.cancelGithubSignInRequest).toHaveBeenCalledOnce();
    vi.mocked(browser.permissions.contains).mockImplementation(async () => true);
    fireEvent.click(screen.getByRole('button', { name: 'Sign in with GitHub' }));
    await waitFor(() => expect(background.startGithubSignIn).toHaveBeenCalledTimes(2));
  }
);

it.each(['while open', 'while closed'])(
  'restores revoked access %s without replacing an existing connection or signing in again',
  async (when) => {
    if (when === 'while closed') vi.mocked(browser.permissions.contains).mockImplementation(async () => false);
    open();
    if (when === 'while open') {
      await waitFor(() => expect(background.listGistDestinations).toHaveBeenCalledOnce());
      vi.mocked(browser.permissions.contains).mockImplementation(async () => false);
      await act(async () => {
        vi.mocked(browser.permissions.onRemoved.addListener).mock.calls[0][0]({
          origins: ['https://api.github.com/*'],
        });
      });
    }
    const button = await screen.findByRole('button', { name: 'Enable GitHub access' });
    expect(screen.getByRole('switch')).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Sign out' })).toBeEnabled();
    vi.mocked(browser.permissions.contains).mockImplementation(async () => true);
    fireEvent.click(button);
    expect(browser.permissions.request).toHaveBeenCalledOnce();
    await waitFor(() => expect(screen.getByRole('switch')).toBeEnabled());
    expect(background.startGithubSignIn).not.toHaveBeenCalled();
    expect(background.setupGistSync).not.toHaveBeenCalled();
    expect(screen.getByRole('link', { name: 'Open backup Gist' })).toHaveAttribute(
      'href',
      'https://gist.github.com/saved'
    );
  }
);

it('dispatches the real proxy message while the permission prompt is still pending', async () => {
  const actual = await vi.importActual<typeof import('@/shared/background-service')>('@/shared/background-service');
  const sendMessage = vi.fn((_message: unknown, reply: (response: unknown) => void) => reply({ res: undefined }));
  vi.stubGlobal('chrome', { runtime: { sendMessage } });
  vi.mocked(background.startGithubSignIn).mockImplementation(() => actual.background.startGithubSignIn());
  service.resolve('getGithubAuthStatus', { ...signedIn, account: null });
  vi.mocked(browser.permissions.contains).mockImplementation(async () => false);
  vi.mocked(browser.permissions.request).mockImplementation(() => new Promise<boolean>(() => {}));
  const { unmount } = open();
  const button = await screen.findByRole('button', { name: 'Sign in with GitHub' });
  await waitFor(() => expect(button).toBeEnabled());
  fireEvent.click(button);
  await waitFor(() =>
    expect(sendMessage).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'proxy-service.background', data: { path: ['startGithubSignIn'], args: [] } }),
      expect.any(Function)
    )
  );
  unmount();
});
