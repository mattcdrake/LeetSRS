/** @vitest-environment happy-dom */
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, expect, it, vi } from 'vitest';
import { storage } from '#imports';
import { background } from '@/shared/background-service';
import { replaceLearningDocument, STORAGE_KEYS } from '@/shared/storage';
import { buildLearningDocument } from '@/test/utils/learning-document-mocks';
import { createServiceMock } from '@/test/utils/service-mocks';
import { createPopupTestWrapper } from '@/test/utils/test-wrapper';
import { GistSyncSection } from '../GistSyncSection';

vi.mock('@/shared/background-service');
const service = createServiceMock(background);
const signedIn = { account: { id: 1, login: 'tester' }, signingIn: false, error: null, migrationNotice: false };
beforeEach(async () => {
  await replaceLearningDocument(buildLearningDocument());
  await storage.setItem(STORAGE_KEYS.gistConnection, { accountId: 1, gistId: 'saved', enabled: false });
  service
    .reset()
    .resolve('getGithubAuthStatus', signedIn)
    .resolve('getGistSyncStatus', {
      lastSyncTime: null,
      lastSyncDirection: null,
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

it('requires an explicit sign-in and does not connect automatically', async () => {
  service.resolve('getGithubAuthStatus', { ...signedIn, account: null }).resolve('startGithubSignIn', undefined);
  open();
  const button = await screen.findByRole('button', { name: 'Sign in with GitHub' });
  await waitFor(() => expect(button).toBeEnabled());
  fireEvent.click(button);
  await waitFor(() => expect(background.startGithubSignIn).toHaveBeenCalledOnce());
  expect(background.setupGistSync).not.toHaveBeenCalled();
  expect(screen.queryByLabelText('Personal Access Token')).not.toBeInTheDocument();
  expect(screen.queryByText(/does not merge individual cards/)).not.toBeInTheDocument();
});

it.each(['backup', 'create'])('connects the selected destination %s only on request', async (value) => {
  open();
  fireEvent.click(await screen.findByRole('button', { name: 'Change' }));
  await screen.findByRole('option', { name: /My backup/ });
  expect(background.setupGistSync).not.toHaveBeenCalled();
  fireEvent.change(screen.getByRole('combobox'), { target: { value } });
  fireEvent.click(screen.getByRole('button', { name: 'Save' }));
  await waitFor(() =>
    expect(background.setupGistSync).toHaveBeenCalledWith(
      value === 'create' ? { mode: 'create' } : { mode: 'existing', gistId: value }
    )
  );
  expect(await screen.findByText('Connection saved')).toBeInTheDocument();
  expect(screen.queryByRole('combobox')).not.toBeInTheDocument();
  expect(screen.queryByText(/does not merge individual cards/)).not.toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'How sync works' })).toBeInTheDocument();
});

it('preserves the connection and selection after a failed change, and allows retry', async () => {
  service.resolve('setupGistSync', { saved: false, error: 'unavailable' });
  open();
  fireEvent.click(await screen.findByRole('button', { name: 'Change' }));
  await screen.findByRole('option', { name: /My backup/ });
  fireEvent.change(screen.getByRole('combobox'), { target: { value: 'backup' } });
  fireEvent.click(screen.getByRole('button', { name: 'Save' }));
  await screen.findByText(/Connection could not be saved/);
  expect(screen.getByRole('combobox')).toHaveValue('backup');
  expect(screen.getByRole('button', { name: 'Save' })).toBeEnabled();
  fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
  expect(screen.queryByRole('combobox')).not.toBeInTheDocument();
  expect(screen.getByRole('link', { name: 'Open backup Gist' })).toHaveAttribute(
    'href',
    'https://gist.github.com/saved'
  );
});

it('disables conflicting controls during connection but permits sign-out', async () => {
  const pending = Promise.withResolvers<{ saved: true }>();
  service.resolve('setupGistSync', pending.promise);
  open();
  fireEvent.click(await screen.findByRole('button', { name: 'Change' }));
  await screen.findByRole('option', { name: /My backup/ });
  fireEvent.click(screen.getByRole('button', { name: 'Save' }));
  await waitFor(() => expect(screen.getByRole('combobox')).toBeDisabled());
  expect(screen.getByRole('switch')).toBeDisabled();
  expect(screen.getByRole('button', { name: 'Sign out' })).toBeEnabled();
  await act(async () => pending.resolve({ saved: true }));
});

it('exposes sign-out and the sync toggle through background commands', async () => {
  service.resolve('signOutGithub', undefined);
  open();
  fireEvent.click(await screen.findByRole('switch'));
  await waitFor(() => expect(background.setGistSyncEnabled).toHaveBeenCalledWith(true));
  fireEvent.click(screen.getByRole('button', { name: 'Sign out' }));
  await waitFor(() => expect(background.signOutGithub).toHaveBeenCalledOnce());
});

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

it('keeps a connected backup compact and cancels edits without saving', async () => {
  open();
  fireEvent.click(await screen.findByRole('button', { name: 'Change' }));
  fireEvent.change(screen.getByRole('combobox'), { target: { value: 'create' } });
  fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
  expect(screen.queryByRole('combobox')).not.toBeInTheDocument();
  expect(screen.getByRole('link', { name: 'Open backup Gist' })).toHaveAttribute(
    'href',
    'https://gist.github.com/saved'
  );
  expect(background.setupGistSync).not.toHaveBeenCalled();
});

it('shows the setup form when no backup is connected', async () => {
  await storage.removeItem(STORAGE_KEYS.gistConnection);
  open();
  await screen.findByRole('option', { name: /My backup/ });
  expect(screen.getByRole('button', { name: 'Connect and sync' })).toBeInTheDocument();
  expect(screen.queryByRole('button', { name: 'Change' })).not.toBeInTheDocument();
  expect(screen.queryByRole('switch')).not.toBeInTheDocument();
});
