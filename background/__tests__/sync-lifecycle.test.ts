import { beforeEach, expect, it, vi } from 'vitest';
import { fakeBrowser } from 'wxt/testing/fake-browser';
import { sync } from '@/background/persistence';
import { onMessage } from '@/shared/messages';
import { readLearningDocument } from '@/shared/storage';
import { dispatchBackgroundCommand as dispatch } from '@/test/utils/background-messages';
import { buildProblem } from '@/test/utils/card-mocks';
import { buildLearningDocument } from '@/test/utils/learning-document-mocks';
import background from '../../entrypoints/background/index';

const github = vi.hoisted(() => ({ get: vi.fn(), update: vi.fn(), create: vi.fn() }));

vi.mock('octokit', () => ({
  Octokit: vi.fn(function MockOctokit() {
    return { rest: { gists: github } };
  }),
}));
vi.mock('@/shared/messages', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/shared/messages')>()),
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
  await dispatch('saveNote', { frontendId: '1', text: 'Saved during sync' });

  expect((await readLearningDocument()).cards['1'].note).toBe('Saved during sync');
  download.resolve({ data: { files: {} } });
  await vi.waitFor(() => expect(github.update).toHaveBeenCalledOnce());
  expect(JSON.parse(github.update.mock.calls[0][0].files['leetsrs-backup.json'].content).cards['1'].note).toBe(
    'Saved during sync'
  );
});

it('leaves edits made during an upload for the next minute sync', async () => {
  const upload = Promise.withResolvers<void>();
  github.update.mockReturnValueOnce(upload.promise);

  await dispatch('addCard', { problem: buildProblem() });
  await vi.waitFor(() => expect(github.update).toHaveBeenCalledOnce());
  await dispatch('saveNote', { frontendId: '1', text: 'Next sync' });
  upload.resolve();
  await vi.waitFor(async () => expect(await dispatch('getGistSyncStatus')).toMatchObject({ syncInProgress: false }));
  expect(github.update).toHaveBeenCalledOnce();

  await triggerSyncAlarm();

  expect(github.update).toHaveBeenCalledTimes(2);
  expect(JSON.parse(github.update.mock.calls[1][0].files['leetsrs-backup.json'].content).cards['1'].note).toBe(
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

  const imported = buildLearningDocument({ settings: { theme: 'dark' }, dataUpdatedAt: '2030-01-01' });
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

it.each(['reset', 'disable', 'external connection'] as const)('ignores a pending download after %s', async (change) => {
  const download = Promise.withResolvers<{ data: { files: Record<string, { content: string }> } }>();
  github.get.mockReturnValueOnce(download.promise);
  const pending = sync();
  await vi.waitFor(() => expect(github.get).toHaveBeenCalledOnce());

  if (change === 'reset') {
    await dispatch('resetAllData');
  } else if (change === 'disable') {
    await dispatch('setGistSyncEnabled', { enabled: false });
  } else {
    await fakeBrowser.storage.sync.set({
      'leetsrs:gistConnection': { pat: 'other', gistId: 'other-gist', enabled: true },
    });
    await vi.waitFor(() => expect(github.get).toHaveBeenCalledWith({ gist_id: 'other-gist' }));
    await vi.waitFor(async () => expect(await dispatch('getGistSyncStatus')).toMatchObject({ syncInProgress: false }));
  }
  const before = await readLearningDocument();
  const status = await dispatch('getGistSyncStatus');
  const uploads = github.update.mock.calls.length;
  download.resolve({
    data: {
      files: {
        'leetsrs-backup.json': {
          content: JSON.stringify(buildLearningDocument({ settings: { theme: 'light' }, dataUpdatedAt: '2099-01-01' })),
        },
      },
    },
  });
  await pending;

  expect(await readLearningDocument()).toEqual(before);
  expect(await dispatch('getGistSyncStatus')).toEqual(status);
  expect(github.update).toHaveBeenCalledTimes(uploads);
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
