/** @vitest-environment happy-dom */
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { beforeEach, expect, it, vi } from 'vitest';
import { browser } from 'wxt/browser';
import { fakeBrowser } from 'wxt/testing/fake-browser';
import { storage } from '#imports';
import { getGithubAuthStatus } from '@/background/github-auth';
import { dismissMigrationNotice, migratePatConnection } from '@/background/legacy/github-pat';
import App from '@/popup/App';
import { background } from '@/shared/background-service';
import { replaceLearningDocument, writePopupDialogAcknowledgments } from '@/shared/storage';
import { buildLearningDocument } from '@/test/utils/learning-document-mocks';
import { createServiceMock } from '@/test/utils/service-mocks';
import { createPopupTestWrapper } from '@/test/utils/test-wrapper';
import { GithubMigrationBanner } from '../GithubMigrationBanner';

vi.hoisted(() => {
  vi.stubGlobal('__APP_VERSION__', 'test');
});

vi.mock('@/shared/background-service');
vi.mock('@/popup/components/LeetcodeCnBanner', () => ({ LeetcodeCnBanner: () => null }));
const service = createServiceMock(background);

beforeEach(async () => {
  fakeBrowser.reset();
  service
    .reset()
    .handle('getGithubAuthStatus', getGithubAuthStatus)
    .handle('dismissMigrationNotice', dismissMigrationNotice);
  await storage.setItem('sync:leetsrs:gistConnection', { pat: 'old-token', gistId: 'previous' });
  await migratePatConnection();
});

it('persists across popup closes until dismissed with X', async () => {
  const content = <GithubMigrationBanner onOpenSettings={vi.fn()} />;
  const view = render(content, { wrapper: createPopupTestWrapper().wrapper });
  expect(await screen.findByRole('button', { name: 'Dismiss GitHub migration notice' })).toBeInTheDocument();
  fireEvent(window, new Event('pagehide'));
  view.unmount();

  const reopened = render(content, { wrapper: createPopupTestWrapper().wrapper });
  fireEvent.click(await screen.findByRole('button', { name: 'Dismiss GitHub migration notice' }));
  await waitFor(() => expect(screen.queryByRole('button', { name: 'Settings' })).not.toBeInTheDocument());
  reopened.unmount();

  const { wrapper, queryClient } = createPopupTestWrapper();
  render(content, { wrapper });
  await waitFor(() => expect(queryClient.isFetching()).toBe(0));
  expect(screen.queryByRole('button', { name: 'Settings' })).not.toBeInTheDocument();
});

it('does not show the banner for an installation without a PAT configuration', async () => {
  fakeBrowser.reset();
  await migratePatConnection();
  const { wrapper, queryClient } = createPopupTestWrapper();
  render(<GithubMigrationBanner onOpenSettings={vi.fn()} />, { wrapper });
  await waitFor(() => expect(queryClient.isFetching()).toBe(0));
  expect(screen.queryByRole('button', { name: 'Settings' })).not.toBeInTheDocument();
});

it('keeps dismissal available if saving fails', async () => {
  service.handle('dismissMigrationNotice', () => {
    throw new Error('Storage unavailable');
  });
  render(<GithubMigrationBanner onOpenSettings={vi.fn()} />, { wrapper: createPopupTestWrapper().wrapper });
  fireEvent.click(await screen.findByRole('button', { name: 'Dismiss GitHub migration notice' }));
  expect(await screen.findByRole('alert')).toHaveTextContent('Could not dismiss');
  expect((await getGithubAuthStatus()).migrationNotice).toBe(true);
  service.handle('dismissMigrationNotice', dismissMigrationNotice);
  fireEvent.click(screen.getByRole('button', { name: 'Dismiss GitHub migration notice' }));
  await waitFor(() => expect(screen.queryByRole('button', { name: 'Settings' })).not.toBeInTheDocument());
});

it('opens highlighted GitHub settings from the header banner without dismissing it', async () => {
  await replaceLearningDocument(buildLearningDocument());
  await writePopupDialogAcknowledgments({ 'release-1.0': true });
  service.resolve('getGistSyncStatus', { lastSyncTime: null, syncInProgress: false, lastError: null });
  vi.spyOn(browser.permissions, 'contains').mockImplementation(async () => true);
  vi.spyOn(browser.permissions.onRemoved, 'addListener').mockImplementation(() => {});
  for (const event of [browser.permissions.onAdded, browser.permissions.onRemoved]) {
    vi.spyOn(event, 'removeListener').mockImplementation(() => {});
  }
  render(<App />, { wrapper: createPopupTestWrapper().wrapper });
  const header = await screen.findByRole('banner');
  fireEvent.click(await within(header).findByRole('button', { name: 'Settings' }));
  expect(await screen.findByRole('button', { name: 'Sign in with GitHub' })).toBeInTheDocument();
  expect(
    screen.getByRole('button', { name: 'Sign in with GitHub' }).closest('.github-sign-in-highlight')
  ).not.toBeNull();
  expect(
    within(screen.getByRole('banner')).getByRole('button', { name: 'Dismiss GitHub migration notice' })
  ).toBeInTheDocument();
  expect(background.dismissMigrationNotice).not.toHaveBeenCalled();
});
