/** @vitest-environment happy-dom */
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, expect, it, vi } from 'vitest';
import { fakeBrowser } from 'wxt/testing/fake-browser';
import { storage } from '#imports';
import { getGithubAuthStatus } from '@/background/github-auth';
import { dismissMigrationNotice, previousGist } from '@/background/legacy/github-pat';
import { acknowledgePopupDialog } from '@/background/popup-dialogs';
import { PopupDialogHost } from '@/popup/dialogs/PopupDialogHost';
import { popupDialogRegistry } from '@/popup/dialogs/registry';
import { background } from '@/shared/background-service';
import { readPopupDialogAcknowledgments, STORAGE_KEYS } from '@/shared/storage';
import { createServiceMock } from '@/test/utils/service-mocks';
import { createPopupTestWrapper } from '@/test/utils/test-wrapper';

vi.mock('@/shared/background-service');
const service = createServiceMock(background);

beforeEach(async () => {
  fakeBrowser.reset();
  service
    .reset()
    .handle('getGithubAuthStatus', getGithubAuthStatus)
    .handle('acknowledgePopupDialog', acknowledgePopupDialog);
  await storage.setItem('local:leetsrs:oauthMigration', { notice: true, previousGist: 'previous' });
});

it.each(['Got it', 'Not now', 'Escape'])(
  'dismisses migration with %s before the release entry and preserves the previous backup',
  async (action) => {
    const onOpenSettings = vi.fn();
    const view = render(<PopupDialogHost onOpenSettings={action === 'Got it' ? undefined : onOpenSettings} />, {
      wrapper: createPopupTestWrapper().wrapper,
    });
    const notice = await screen.findByRole('dialog', { name: 'Reconnect backup' });
    expect(screen.getAllByRole('dialog')).toHaveLength(1);
    expect(screen.getByText('Your learning data is safe on this device.')).toBeInTheDocument();
    if (action === 'Escape') fireEvent.keyDown(notice, { key: 'Escape', code: 'Escape' });
    else fireEvent.click(screen.getByRole('button', { name: action }));

    expect(await screen.findByRole('dialog', { name: 'LeetSRS 1.0' })).toBeInTheDocument();
    expect(await readPopupDialogAcknowledgments()).toEqual({ 'github-migration': true });
    expect(await previousGist()).toBe('previous');
    expect(onOpenSettings).not.toHaveBeenCalled();

    view.unmount();
    render(<PopupDialogHost />, { wrapper: createPopupTestWrapper().wrapper });
    expect(await screen.findByRole('dialog', { name: 'LeetSRS 1.0' })).toBeInTheDocument();
  }
);

it('opens settings immediately and advances even when saving the dismissal fails', async () => {
  const pending = Promise.withResolvers<void>();
  const onOpenSettings = vi.fn();
  service.resolve('acknowledgePopupDialog', pending.promise);
  vi.spyOn(console, 'warn').mockImplementation(() => {});
  render(<PopupDialogHost onOpenSettings={onOpenSettings} />, { wrapper: createPopupTestWrapper().wrapper });
  fireEvent.click(await screen.findByRole('button', { name: 'Open settings' }));
  expect(onOpenSettings).toHaveBeenCalledOnce();
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  await act(async () => pending.reject(new Error('Storage unavailable')));
  expect(await screen.findByRole('dialog', { name: 'LeetSRS 1.0' })).toBeInTheDocument();
  expect(background.acknowledgePopupDialog).toHaveBeenCalledExactlyOnceWith('github-migration');
  expect(screen.queryByRole('alert')).not.toBeInTheDocument();
});

it.each(['fresh install', 'previously dismissed'])(
  'skips migration for a %s and remembers release dismissal',
  async (state) => {
    if (state === 'fresh install') await storage.removeItem('local:leetsrs:oauthMigration');
    else await dismissMigrationNotice();
    const view = render(<PopupDialogHost />, { wrapper: createPopupTestWrapper().wrapper });
    expect(await screen.findByRole('dialog', { name: 'LeetSRS 1.0' })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Continue' }));
    await waitFor(async () => expect(await readPopupDialogAcknowledgments()).toEqual({ 'release-1.0': true }));
    view.unmount();
    const { wrapper, queryClient } = createPopupTestWrapper();
    render(<PopupDialogHost />, { wrapper });
    await waitFor(() => expect(queryClient.isFetching()).toBe(0));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  }
);

it('updates migration eligibility when its legacy notice is cleared while the popup is open', async () => {
  render(<PopupDialogHost />, { wrapper: createPopupTestWrapper().wrapper });
  expect(await screen.findByRole('dialog', { name: 'Reconnect backup' })).toBeInTheDocument();
  await act(() => dismissMigrationNotice());
  expect(await screen.findByRole('dialog', { name: 'LeetSRS 1.0' })).toBeInTheDocument();
  expect(await readPopupDialogAcknowledgments()).toEqual({});
});

it('keeps migration pending independently when the release entry is replaced', async () => {
  await storage.setItem(STORAGE_KEYS.popupDialogAcknowledgments, { 'release-1.0': true });
  const registry = popupDialogRegistry.map((entry) =>
    entry.id === 'release-1.0' ? { ...entry, id: 'release-1.1' } : entry
  );
  render(<PopupDialogHost registry={registry} />, { wrapper: createPopupTestWrapper().wrapper });
  expect(await screen.findByRole('dialog', { name: 'Reconnect backup' })).toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'Got it' }));
  fireEvent.click(await screen.findByRole('button', { name: 'Continue' }));
  await waitFor(async () =>
    expect(await readPopupDialogAcknowledgments()).toEqual({
      'github-migration': true,
      'release-1.0': true,
      'release-1.1': true,
    })
  );
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
});
