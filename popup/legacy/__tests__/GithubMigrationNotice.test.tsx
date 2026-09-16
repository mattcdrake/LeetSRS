/** @vitest-environment happy-dom */
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, expect, it, vi } from 'vitest';
import { GithubMigrationNotice } from '@/popup/legacy/GithubMigrationNotice';
import { background } from '@/shared/background-service';
import { createServiceMock } from '@/test/utils/service-mocks';
import { createPopupTestWrapper } from '@/test/utils/test-wrapper';

vi.mock('@/shared/background-service');
const service = createServiceMock(background);
const signedIn = { account: null, signingIn: false, error: null, migrationNotice: false, setupPending: false };
beforeEach(() => {
  service.reset();
});

it('dismisses the migration notice', async () => {
  service
    .resolve('getGithubAuthStatus', { ...signedIn, migrationNotice: true })
    .resolve('dismissMigrationNotice', undefined);
  render(<GithubMigrationNotice />, { wrapper: createPopupTestWrapper().wrapper });
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
