/** @vitest-environment happy-dom */
import { onlineManager } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { browser } from 'wxt/browser';
import { fakeBrowser } from 'wxt/testing/fake-browser';
import backgroundEntry from '@/entrypoints/background/index';
import { background } from '@/shared/background-service';
import { readGistConnection, readLearningDocument } from '@/shared/storage';
import { getRegisteredBackground } from '@/test/utils/background-service';
import { buildProblem } from '@/test/utils/card-mocks';
import { seedGithubAuthorization } from '@/test/utils/github-auth';
import { createServiceMock } from '@/test/utils/service-mocks';
import { createPopupTestWrapper } from '@/test/utils/test-wrapper';
import { GistSyncSection } from '../GistSyncSection';

const github = vi.hoisted(() => ({ get: vi.fn(), list: vi.fn(), update: vi.fn(), create: vi.fn() }));
vi.mock('octokit', () => ({
  Octokit: vi.fn(function MockOctokit() {
    return { rest: { gists: github } };
  }),
}));
vi.mock('@webext-core/proxy-service', () => import('@/test/mocks/proxy-service'));
vi.mock('@/shared/background-service');

beforeEach(async () => {
  fakeBrowser.reset();
  fakeBrowser.runtime.id = 'test';
  vi.spyOn(browser.permissions.onRemoved, 'addListener').mockImplementation(() => {});
  for (const event of [browser.permissions.onAdded, browser.permissions.onRemoved]) {
    vi.spyOn(event, 'removeListener').mockImplementation(() => {});
  }
  backgroundEntry.main();
  createServiceMock(background).reset().use(getRegisteredBackground());
  await background.waitForInitialization();
  await seedGithubAuthorization();
  await background.addCard(buildProblem());
  const document = await readLearningDocument();
  github.get.mockResolvedValue({
    data: { owner: { id: 1 }, files: { 'leetsrs-backup.json': { content: JSON.stringify(document) } } },
  });
  github.list.mockResolvedValue({
    data: [
      {
        id: 'backup',
        description: 'My backup',
        owner: { id: 1 },
        updated_at: '2026-09-15',
        files: { 'leetsrs-backup.json': {} },
      },
    ],
  });
  github.create.mockResolvedValue({ data: { id: 'created' } });
});

it('connects, cancels a change, preserves the old connection on failure, retries creation and signs out', async () => {
  const before = await readLearningDocument();
  render(<GistSyncSection />, { wrapper: createPopupTestWrapper().wrapper });
  await screen.findByRole('option', { name: /My backup/ });
  expect(await readGistConnection()).toEqual({ accountId: null, gistId: null, enabled: false });
  expect(github.get).not.toHaveBeenCalled();
  fireEvent.change(screen.getByRole('combobox'), { target: { value: 'backup' } });
  fireEvent.click(screen.getByRole('button', { name: 'Connect and sync' }));
  await screen.findByText('Connection saved');
  expect(await readGistConnection()).toEqual({ accountId: 1, gistId: 'backup', enabled: true });
  expect(screen.getByRole('link', { name: 'Open backup Gist' })).toHaveAttribute(
    'href',
    'https://gist.github.com/backup'
  );
  expect(screen.queryByRole('combobox')).not.toBeInTheDocument();
  expect(await readLearningDocument()).toEqual(before);

  fireEvent.click(screen.getByRole('switch'));
  await waitFor(() => expect(screen.getByRole('switch')).not.toBeChecked());
  expect((await readGistConnection()).enabled).toBe(false);
  fireEvent.click(screen.getByRole('button', { name: 'Change' }));
  fireEvent.change(screen.getByRole('combobox'), { target: { value: 'create' } });
  fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
  expect(github.create).not.toHaveBeenCalled();
  expect((await readGistConnection()).gistId).toBe('backup');

  fireEvent.click(screen.getByRole('button', { name: 'Change' }));
  fireEvent.change(screen.getByRole('combobox'), { target: { value: 'create' } });
  github.create.mockRejectedValueOnce(new Error('Network unavailable'));
  fireEvent.click(screen.getByRole('button', { name: 'Save' }));
  await screen.findByText(/Connection could not be saved/);
  expect(screen.getByRole('combobox')).toHaveValue('create');
  expect(await readGistConnection()).toEqual({ accountId: 1, gistId: 'backup', enabled: false });
  expect(await readLearningDocument()).toEqual(before);

  const pending = Promise.withResolvers<{ data: { id: string } }>();
  github.create.mockReturnValueOnce(pending.promise);
  fireEvent.click(screen.getByRole('button', { name: 'Save' }));
  await waitFor(() => expect(screen.getByRole('combobox')).toBeDisabled());
  expect(screen.getByRole('switch')).toBeDisabled();
  expect(screen.getByRole('button', { name: 'Sign out' })).toBeEnabled();
  pending.resolve({ data: { id: 'created' } });
  await screen.findByText('Connection saved');
  expect(await readGistConnection()).toEqual({ accountId: 1, gistId: 'created', enabled: true });
  expect(JSON.parse(github.create.mock.calls[1][0].files['leetsrs-backup.json'].content)).toEqual(before);
  fireEvent.click(screen.getByRole('button', { name: 'Sign out' }));
  await screen.findByRole('button', { name: 'Sign in with GitHub' });
  expect(await readGistConnection()).toEqual({ accountId: null, gistId: null, enabled: false });
  expect((await background.getGithubAuthStatus()).account).toBeNull();
  expect(await readLearningDocument()).toEqual(before);
});

afterEach(() => onlineManager.setOnline(true));

it('lets the user disable automatic sync while offline without fetching the backup', async () => {
  await background.setupGistSync({ mode: 'existing', gistId: 'backup' });
  render(<GistSyncSection />, { wrapper: createPopupTestWrapper().wrapper });
  const toggle = await screen.findByRole('switch');
  await waitFor(() => expect(toggle).toBeEnabled());
  expect(toggle).toBeChecked();
  github.get.mockClear();
  onlineManager.setOnline(false);
  fireEvent.click(toggle);
  await waitFor(() => expect(toggle).not.toBeChecked());
  expect(await screen.findByRole('status')).toHaveTextContent('Connection saved');
  expect(github.get).not.toHaveBeenCalled();
});
