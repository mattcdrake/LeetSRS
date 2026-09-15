import { registerService } from '@webext-core/proxy-service';
import { beforeEach, expect, it, vi } from 'vitest';
import { fakeBrowser } from 'wxt/testing/fake-browser';
import { sync } from '@/background/persistence';
import { readLearningDocument } from '@/shared/storage';
import { getRegisteredBackground } from '@/test/utils/background-service';
import { buildProblem } from '@/test/utils/card-mocks';
import { seedGithubAuthorization } from '@/test/utils/github-auth';
import { buildLearningDocument } from '@/test/utils/learning-document-mocks';
import backgroundEntry from '../../entrypoints/background/index';

const github = vi.hoisted(() => ({ get: vi.fn(), update: vi.fn(), create: vi.fn() }));

vi.mock('octokit', () => ({
  Octokit: vi.fn(function MockOctokit() {
    return { rest: { gists: github } };
  }),
}));
vi.mock('@webext-core/proxy-service', () => import('@/test/mocks/proxy-service'));

beforeEach(async () => {
  fakeBrowser.reset();
  fakeBrowser.runtime.id = 'test';
  vi.mocked(registerService).mockClear();
  github.get.mockResolvedValue({ data: { files: {} } });
  github.update.mockResolvedValue({});
  backgroundEntry.main();
  await getRegisteredBackground().waitForInitialization();
  await getRegisteredBackground().resetAllData();
  await seedGithubAuthorization();
  await fakeBrowser.storage.local.set({
    'leetsrs:gistConnection': { accountId: 1, gistId: 'gist', enabled: true },
  });
  await vi.waitFor(() => expect(github.update).toHaveBeenCalledOnce());
  await vi.waitFor(async () =>
    expect(await getRegisteredBackground().getGistSyncStatus()).toMatchObject({ syncInProgress: false })
  );
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

  await getRegisteredBackground().addCard(buildProblem());
  await vi.waitFor(() => expect(github.get).toHaveBeenCalledOnce());
  await getRegisteredBackground().saveNote('1', 'Saved during sync');

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

  await getRegisteredBackground().addCard(buildProblem());
  await vi.waitFor(() => expect(github.update).toHaveBeenCalledOnce());
  await getRegisteredBackground().saveNote('1', 'Next sync');
  upload.resolve();
  await vi.waitFor(async () =>
    expect(await getRegisteredBackground().getGistSyncStatus()).toMatchObject({ syncInProgress: false })
  );
  expect(github.update).toHaveBeenCalledOnce();

  await triggerSyncAlarm();

  expect(github.update).toHaveBeenCalledTimes(2);
  expect(JSON.parse(github.update.mock.calls[1][0].files['leetsrs-backup.json'].content).cards['1'].note).toBe(
    'Next sync'
  );
});

it('does not sync while disabled and starts syncing when enabled', async () => {
  await getRegisteredBackground().setGistSyncEnabled(false);
  github.get.mockClear();

  await getRegisteredBackground().addCard(buildProblem());
  await triggerSyncAlarm();
  expect(github.get).not.toHaveBeenCalled();

  expect(await getRegisteredBackground().setGistSyncEnabled(true)).toEqual({ saved: true });
  await vi.waitFor(() => expect(github.get).toHaveBeenCalledOnce());
});

it('ignores a download that finishes after an import', async () => {
  const download = Promise.withResolvers<{ data: { files: Record<string, { content: string }> } }>();
  github.get.mockReturnValueOnce(download.promise);
  await getRegisteredBackground().addCard(buildProblem());
  await vi.waitFor(() => expect(github.get).toHaveBeenCalledOnce());

  const imported = buildLearningDocument({ settings: { theme: 'dark' }, dataUpdatedAt: '2030-01-01' });
  await getRegisteredBackground().importData(JSON.stringify(imported));
  download.resolve({
    data: {
      files: {
        'leetsrs-backup.json': {
          content: JSON.stringify({ ...imported, settings: { theme: 'light' }, dataUpdatedAt: '2099-01-01' }),
        },
      },
    },
  });

  await vi.waitFor(async () =>
    expect(await getRegisteredBackground().getGistSyncStatus()).toMatchObject({ syncInProgress: false })
  );
  expect(await readLearningDocument()).toEqual(imported);
});

it.each(['reset', 'disable', 'external connection'] as const)('ignores a pending download after %s', async (change) => {
  const download = Promise.withResolvers<{ data: { files: Record<string, { content: string }> } }>();
  github.get.mockReturnValueOnce(download.promise);
  const pending = sync();
  await vi.waitFor(() => expect(github.get).toHaveBeenCalledOnce());

  if (change === 'reset') {
    await getRegisteredBackground().resetAllData();
  } else if (change === 'disable') {
    await getRegisteredBackground().setGistSyncEnabled(false);
  } else {
    await fakeBrowser.storage.local.set({
      'leetsrs:gistConnection': { accountId: 1, gistId: 'other-gist', enabled: true },
    });
    await vi.waitFor(() => expect(github.get).toHaveBeenCalledWith({ gist_id: 'other-gist' }));
    await vi.waitFor(async () =>
      expect(await getRegisteredBackground().getGistSyncStatus()).toMatchObject({ syncInProgress: false })
    );
  }
  const before = await readLearningDocument();
  const status = await getRegisteredBackground().getGistSyncStatus();
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
  expect(await getRegisteredBackground().getGistSyncStatus()).toEqual(status);
  expect(github.update).toHaveBeenCalledTimes(uploads);
});

it('retries a failed save from the minute alarm', async () => {
  github.get.mockRejectedValueOnce(new TypeError('Failed to fetch'));
  await getRegisteredBackground().addCard(buildProblem());
  await vi.waitFor(async () =>
    expect(await getRegisteredBackground().getGistSyncStatus()).toMatchObject({
      lastError: 'unavailable',
      syncInProgress: false,
    })
  );

  await triggerSyncAlarm();

  expect(github.update).toHaveBeenCalledOnce();
  expect(await getRegisteredBackground().getGistSyncStatus()).toMatchObject({ lastError: null });
});
