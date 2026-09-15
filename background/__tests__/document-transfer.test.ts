import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fakeBrowser } from 'wxt/testing/fake-browser';
import { onMessage } from '@/shared/messages';
import { LEARNING_DOCUMENT_VERSION } from '@/shared/models';
import { readGistConnection, readLearningDocument } from '@/shared/storage';
import { dispatchBackgroundCommand as dispatch } from '@/test/utils/background-messages';
import { validLegacyBackup } from '@/test/utils/backup-mocks';
import { buildProblem } from '@/test/utils/card-mocks';
import { buildLearningDocument } from '@/test/utils/learning-document-mocks';
import { getSettings } from '@/test/utils/learning-reads';
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
  background.main();
  await dispatch('waitForInitialization');
  await dispatch('resetAllData');
  await fakeBrowser.storage.sync.set({
    'leetsrs:gistConnection': { pat: 'secret', gistId: 'gist', enabled: false },
  });
});

describe('document transfers through background commands', () => {
  it('replaces the whole document from a file without replacing the Gist connection', async () => {
    await dispatch('addCard', { problem: buildProblem() });
    await dispatch('saveNote', { frontendId: '1', text: 'Omitted from replacement' });
    const replacement = {
      ...(await readLearningDocument()),
      cards: {},
      settings: {},
      dataUpdatedAt: '2099-01-01T00:00:00.000Z',
    };

    await dispatch('importData', { jsonData: JSON.stringify(replacement) });

    expect(await readLearningDocument()).toEqual(replacement);
    expect(await getSettings()).toMatchObject({ theme: 'system' });
    expect(await readGistConnection()).toEqual({ pat: 'secret', gistId: 'gist', enabled: false });
  });

  it.each([true, false])('imports historical data with an explicit timestamp: %s', async (hasTimestamp) => {
    const { backup, converted } = validLegacyBackup();
    const input = { ...backup, dataUpdatedAt: hasTimestamp ? backup.dataUpdatedAt : undefined };

    await dispatch('importData', { jsonData: JSON.stringify(input) });

    expect(await readLearningDocument()).toEqual(
      buildLearningDocument({
        ...converted,
        settings: { resetEditorOnReviewQueue: false },
        dataUpdatedAt: hasTimestamp ? backup.dataUpdatedAt : backup.exportDate,
      })
    );
    expect(await readGistConnection()).toEqual({ pat: 'secret', gistId: 'gist', enabled: false });
  });

  it('retains all data after a rejected import and accepts a later edit', async () => {
    await dispatch('addCard', { problem: buildProblem() });
    const before = await readLearningDocument();
    vi.spyOn(fakeBrowser.storage.local, 'set').mockRejectedValueOnce(new Error('Document unavailable'));

    await expect(
      dispatch('importData', {
        jsonData: JSON.stringify(buildLearningDocument({ dataUpdatedAt: '2099-01-01T00:00:00.000Z' })),
      })
    ).rejects.toThrow('Document unavailable');

    expect(await readLearningDocument()).toEqual(before);
    await dispatch('saveNote', { frontendId: '1', text: 'After failure' });
    expect((await readLearningDocument()).cards['1']?.note).toBe('After failure');
  });

  it('rejects future data before overwriting the local document', async () => {
    await dispatch('addCard', { problem: buildProblem() });
    const before = await readLearningDocument();

    await expect(
      dispatch('importData', {
        jsonData: JSON.stringify({ schemaVersion: LEARNING_DOCUMENT_VERSION + 1, cards: {}, stats: {}, settings: {} }),
      })
    ).rejects.toThrow();

    expect(await readLearningDocument()).toEqual(before);
  });

  it.each([false, true])(
    'creates a Gist with one sync and no learning edit (delayed write: %s)',
    async (delayedWrite) => {
      await dispatch('updateSettings', { changes: { language: 'zh-CN' } });
      const before = await readLearningDocument();
      github.create.mockResolvedValueOnce({ data: { id: 'created-gist' } });
      github.get.mockResolvedValue({
        data: { files: { 'leetsrs-backup.json': { content: JSON.stringify(before) } } },
      });

      const releaseWrite = Promise.withResolvers<void>();
      if (delayedWrite) {
        const write = fakeBrowser.storage.sync.set.bind(fakeBrowser.storage.sync);
        vi.spyOn(fakeBrowser.storage.sync, 'set').mockImplementationOnce(async (items) => {
          await write(items);
          await releaseWrite.promise;
        });
      }
      const setup = dispatch('setupGistSync', { mode: 'create', pat: 'entered' });
      await vi.waitFor(() => expect(github.get).toHaveBeenCalledWith({ gist_id: 'created-gist' }));
      await vi.waitFor(async () =>
        expect(await dispatch('getGistSyncStatus')).toMatchObject({ syncInProgress: false })
      );
      releaseWrite.resolve();
      expect(await setup).toEqual({ saved: true });

      expect(JSON.parse(github.create.mock.calls[0][0].files['leetsrs-backup.json'].content)).toEqual(before);
      expect(await readGistConnection()).toEqual({ pat: 'entered', gistId: 'created-gist', enabled: true });
      await vi.waitFor(() => expect(github.get).toHaveBeenCalledWith({ gist_id: 'created-gist' }));
      await vi.waitFor(async () =>
        expect(await dispatch('getGistSyncStatus')).toMatchObject({ syncInProgress: false })
      );
      expect(github.get).toHaveBeenCalledOnce();
      expect(await readLearningDocument()).toEqual(before);
    }
  );
});
