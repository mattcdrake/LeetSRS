/** @vitest-environment happy-dom */
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, expect, it, vi } from 'vitest';
import { storage } from '#imports';
import { GithubMigrationNotice } from '@/popup/components/GithubMigrationNotice';
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
});

it.each(['backup', 'create'])('connects the selected destination %s only on request', async (value) => {
  open();
  await screen.findByRole('option', { name: /My backup/ });
  expect(background.setupGistSync).not.toHaveBeenCalled();
  fireEvent.change(screen.getByRole('combobox'), { target: { value } });
  fireEvent.click(screen.getByRole('button', { name: 'Connect and sync' }));
  await waitFor(() =>
    expect(background.setupGistSync).toHaveBeenCalledWith(
      value === 'create' ? { mode: 'create' } : { mode: 'existing', gistId: value }
    )
  );
  expect(await screen.findByText('Connection saved')).toBeInTheDocument();
  expect(screen.getByText(/does not merge individual cards/)).toBeInTheDocument();
});

it('preserves the connection and selection after a failed change, and allows retry', async () => {
  service.resolve('setupGistSync', { saved: false, error: 'unavailable' });
  open();
  await screen.findByRole('option', { name: /My backup/ });
  fireEvent.change(screen.getByRole('combobox'), { target: { value: 'backup' } });
  fireEvent.click(screen.getByRole('button', { name: 'Connect and sync' }));
  await screen.findByText(/Connection could not be saved/);
  expect(screen.getByRole('combobox')).toHaveValue('backup');
  expect(screen.getByRole('link', { name: 'Open backup Gist' })).toHaveAttribute(
    'href',
    'https://gist.github.com/saved'
  );
  expect(screen.getByRole('button', { name: 'Connect and sync' })).toBeEnabled();
});

it('disables conflicting controls during connection but permits sign-out', async () => {
  const pending = Promise.withResolvers<{ saved: true }>();
  service.resolve('setupGistSync', pending.promise);
  open();
  await screen.findByRole('option', { name: /My backup/ });
  fireEvent.click(screen.getByRole('button', { name: 'Connect and sync' }));
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

it('dismisses the migration notice', async () => {
  service
    .resolve('getGithubAuthStatus', { ...signedIn, migrationNotice: true })
    .resolve('dismissMigrationNotice', undefined);
  open();
  fireEvent.click(await screen.findByRole('button', { name: 'Got it' }));
  await waitFor(() => expect(background.dismissMigrationNotice).toHaveBeenCalledOnce());
  await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
});

it('opens settings after saving the migration dismissal', async () => {
  const pending = Promise.withResolvers<void>();
  const onOpenSettings = vi.fn();
  service
    .resolve('getGithubAuthStatus', { ...signedIn, migrationNotice: true })
    .resolve('dismissMigrationNotice', pending.promise);
  render(<GithubMigrationNotice onOpenSettings={onOpenSettings} />, {
    wrapper: createPopupTestWrapper().wrapper,
  });
  fireEvent.click(await screen.findByRole('button', { name: 'Open settings' }));
  await waitFor(() => expect(background.dismissMigrationNotice).toHaveBeenCalledOnce());
  expect(onOpenSettings).not.toHaveBeenCalled();
  await act(async () => pending.resolve());
  await waitFor(() => expect(onOpenSettings).toHaveBeenCalledOnce());
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
});
