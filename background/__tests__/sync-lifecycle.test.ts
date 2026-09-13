import { beforeEach, expect, it, vi } from 'vitest';
import { fakeBrowser } from 'wxt/testing/fake-browser';
import { readLearningDocument } from '@/data/learning-document';
import { onMessage } from '@/integrations/browser/messages';
import { dispatchBackgroundCommand as dispatch } from '@/test/utils/background-messages';
import { buildProblem } from '@/test/utils/card-mocks';
import background from '../../entrypoints/background/index';

const github = vi.hoisted(() => ({ get: vi.fn(), update: vi.fn(), create: vi.fn() }));

vi.mock('octokit', () => ({
  Octokit: vi.fn(function MockOctokit() {
    return { rest: { gists: github } };
  }),
}));
vi.mock('@/integrations/browser/messages', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/integrations/browser/messages')>()),
  onMessage: vi.fn(),
}));

beforeEach(async () => {
  fakeBrowser.reset();
  fakeBrowser.runtime.id = 'test';
  vi.mocked(onMessage).mockClear();
  github.get.mockResolvedValue({ data: { files: {} } });
  github.update.mockResolvedValue({});
  background.main();
  await dispatch('waitForInitialization');
  await dispatch('resetAllData');
  await fakeBrowser.storage.sync.set({
    'leetsrs:gistConnection': { pat: 'secret', gistId: 'gist', enabled: true },
  });
  await vi.waitFor(() => expect(github.update).toHaveBeenCalledOnce());
  await vi.waitFor(async () => expect(await dispatch('getGistSyncStatus')).toMatchObject({ syncInProgress: false }));
  github.get.mockClear();
  github.update.mockClear();
});

async function triggerSyncAlarm() {
  await fakeBrowser.alarms.onAlarm.trigger({
    name: 'gist-sync',
    scheduledTime: Date.now(),
    periodInMinutes: 1,
    persistAcrossSessions: true,
  });
}

it('keeps local writes responsive while sync is in flight', async () => {
  const download = Promise.withResolvers<{ data: { files: Record<string, never> } }>();
  github.get.mockReturnValueOnce(download.promise);

  await dispatch('addCard', { problem: buildProblem() });
  await vi.waitFor(() => expect(github.get).toHaveBeenCalledOnce());
  await dispatch('saveNote', { slug: 'two-sum', text: 'Saved during sync' });

  expect((await readLearningDocument()).cards['two-sum'].note).toBe('Saved during sync');
  download.resolve({ data: { files: {} } });
  await vi.waitFor(() => expect(github.update).toHaveBeenCalledOnce());
  expect(JSON.parse(github.update.mock.calls[0][0].files['leetsrs-backup.json'].content).cards['two-sum'].note).toBe(
    'Saved during sync'
  );
});

it('leaves edits made during an upload for the next minute sync', async () => {
  const upload = Promise.withResolvers<void>();
  github.update.mockReturnValueOnce(upload.promise);

  await dispatch('addCard', { problem: buildProblem() });
  await vi.waitFor(() => expect(github.update).toHaveBeenCalledOnce());
  await dispatch('saveNote', { slug: 'two-sum', text: 'Next sync' });
  upload.resolve();
  await vi.waitFor(async () => expect(await dispatch('getGistSyncStatus')).toMatchObject({ syncInProgress: false }));
  expect(github.update).toHaveBeenCalledOnce();

  await triggerSyncAlarm();

  expect(github.update).toHaveBeenCalledTimes(2);
  expect(JSON.parse(github.update.mock.calls[1][0].files['leetsrs-backup.json'].content).cards['two-sum'].note).toBe(
    'Next sync'
  );
});

it('does not sync while disabled and starts syncing when enabled', async () => {
  await dispatch('setGistSyncEnabled', { enabled: false });
  github.get.mockClear();

  await dispatch('addCard', { problem: buildProblem() });
  await triggerSyncAlarm();
  expect(github.get).not.toHaveBeenCalled();

  expect(await dispatch('setGistSyncEnabled', { enabled: true })).toEqual({ saved: true });
  await vi.waitFor(() => expect(github.get).toHaveBeenCalledOnce());
});

it('ignores a download that finishes after an import', async () => {
  const download = Promise.withResolvers<{ data: { files: Record<string, { content: string }> } }>();
  github.get.mockReturnValueOnce(download.promise);
  await dispatch('addCard', { problem: buildProblem() });
  await vi.waitFor(() => expect(github.get).toHaveBeenCalledOnce());

  const imported = { schemaVersion: 7, cards: {}, stats: {}, settings: { theme: 'dark' }, dataUpdatedAt: '2030-01-01' };
  await dispatch('importData', { jsonData: JSON.stringify(imported) });
  download.resolve({
    data: {
      files: {
        'leetsrs-backup.json': {
          content: JSON.stringify({ ...imported, settings: { theme: 'light' }, dataUpdatedAt: '2099-01-01' }),
        },
      },
    },
  });

  await vi.waitFor(async () => expect(await dispatch('getGistSyncStatus')).toMatchObject({ syncInProgress: false }));
  expect(await readLearningDocument()).toEqual(imported);
});

it('retries a failed save from the minute alarm', async () => {
  github.get.mockRejectedValueOnce(new TypeError('Failed to fetch'));
  await dispatch('addCard', { problem: buildProblem() });
  await vi.waitFor(async () =>
    expect(await dispatch('getGistSyncStatus')).toMatchObject({ lastError: 'unavailable', syncInProgress: false })
  );

  await triggerSyncAlarm();

  expect(github.update).toHaveBeenCalledOnce();
  expect(await dispatch('getGistSyncStatus')).toMatchObject({ lastError: null });
});
