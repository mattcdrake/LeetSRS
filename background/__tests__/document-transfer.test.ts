import { registerService } from '@webext-core/proxy-service';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fakeBrowser } from 'wxt/testing/fake-browser';
import { LEARNING_DOCUMENT_VERSION } from '@/shared/models';
import { readGistConnection, readLearningDocument } from '@/shared/storage';
import { getRegisteredBackground } from '@/test/utils/background-service';
import { validLegacyBackup } from '@/test/utils/backup-mocks';
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
  backgroundEntry.main();
  await getRegisteredBackground().waitForInitialization();
  await getRegisteredBackground().resetAllData();
  await seedGithubAuthorization();
  await fakeBrowser.storage.local.set({
    'leetsrs:gistConnection': { accountId: 1, gistId: 'gist', enabled: false },
  });
});

describe('document transfers through background commands', () => {
  it('round-trips roadmap choices through export/import and clears them on reset', async () => {
    await getRegisteredBackground().setActiveRoadmap('grind-75');
    await getRegisteredBackground().setRoadmapProblemSkipped('grind-75', '1', true);
    const document = await readLearningDocument();
    const exported = JSON.stringify(document, null, 2);
    await getRegisteredBackground().resetAllData();
    expect(await readLearningDocument()).toEqual(buildLearningDocument());

    await getRegisteredBackground().importData(exported);
    expect(await readLearningDocument()).toEqual(document);
    expect(document.activeRoadmapId).toBe('grind-75');
    expect(document.roadmapSkips).toEqual({ 'grind-75': ['1'] });
  });

  it('retains all data after a rejected import and accepts a later edit', async () => {
    await getRegisteredBackground().addCard(buildProblem());
    const before = await readLearningDocument();
    vi.spyOn(fakeBrowser.storage.local, 'set').mockRejectedValueOnce(new Error('Document unavailable'));

    await expect(
      getRegisteredBackground().importData(
        JSON.stringify(buildLearningDocument({ dataUpdatedAt: '2099-01-01T00:00:00.000Z' }))
      )
    ).rejects.toThrow('Document unavailable');

    expect(await readLearningDocument()).toEqual(before);
    await getRegisteredBackground().saveNote('1', 'After failure');
    expect((await readLearningDocument()).cards['1']?.note).toBe('After failure');
  });

  it.each([false, true])(
    'creates a Gist with one sync and no learning edit (delayed write: %s)',
    async (delayedWrite) => {
      await getRegisteredBackground().updateSettings({ language: 'zh-CN' });
      const before = await readLearningDocument();
      github.create.mockResolvedValueOnce({ data: { id: 'created-gist' } });
      github.get.mockResolvedValue({
        data: { files: { 'leetsrs-backup.json': { content: JSON.stringify(before) } } },
      });

      const releaseWrite = Promise.withResolvers<void>();
      if (delayedWrite) {
        const write = fakeBrowser.storage.local.set.bind(fakeBrowser.storage.local);
        vi.spyOn(fakeBrowser.storage.local, 'set').mockImplementationOnce(async (items) => {
          await write(items);
          await releaseWrite.promise;
        });
      }
      const setup = getRegisteredBackground().setupGistSync({ mode: 'create' });
      await vi.waitFor(() => expect(github.get).toHaveBeenCalledWith({ gist_id: 'created-gist' }));
      await vi.waitFor(async () =>
        expect(await getRegisteredBackground().getGistSyncStatus()).toMatchObject({ syncInProgress: false })
      );
      releaseWrite.resolve();
      expect(await setup).toEqual({ saved: true });

      expect(JSON.parse(github.create.mock.calls[0][0].files['leetsrs-backup.json'].content)).toEqual(before);
      expect(await readGistConnection()).toEqual({ accountId: 1, gistId: 'created-gist', enabled: true });
      await vi.waitFor(() => expect(github.get).toHaveBeenCalledWith({ gist_id: 'created-gist' }));
      await vi.waitFor(async () =>
        expect(await getRegisteredBackground().getGistSyncStatus()).toMatchObject({ syncInProgress: false })
      );
      expect(github.get).toHaveBeenCalledOnce();
      expect(await readLearningDocument()).toEqual(before);
    }
  );
});

it.each([0, 2, 3, 4, 6, 7, 9, 10, LEARNING_DOCUMENT_VERSION])(
  'imports version %i through the registered service and persists the complete converted document',
  async (schemaVersion) => {
    const { backup, converted, legacyConverted } = validLegacyBackup();
    const data = {
      ...(schemaVersion < 4
        ? backup.data
        : schemaVersion < 9
          ? legacyConverted
          : schemaVersion === 9
            ? { cards: legacyConverted.cards, reviewActivity: converted.reviewActivity }
            : converted),
      ...(schemaVersion >= 12 && { activeRoadmapId: null, roadmapSkips: {} }),
      settings: {
        theme: 'light',
        language: schemaVersion < 11 ? 'de' : 'en',
        maxNewCardsPerDay: 7,
        ...(schemaVersion < 3
          ? { autoClearLeetcode: true }
          : schemaVersion < 7
            ? { resetEditorOnEveryProblem: true }
            : { resetEditorOnReviewQueue: true }),
      },
    };
    const input =
      schemaVersion < 6
        ? { schemaVersion, exportDate: backup.exportDate, data }
        : { schemaVersion, dataUpdatedAt: backup.dataUpdatedAt, ...data };
    await getRegisteredBackground().addCard(buildProblem({ frontendId: 'discard' }));
    await getRegisteredBackground().importData(JSON.stringify(input));
    expect(await readLearningDocument()).toEqual(
      buildLearningDocument({
        ...converted,
        settings: { theme: 'light', language: 'en', maxNewCardsPerDay: 7, resetEditorOnReviewQueue: true },
        dataUpdatedAt: backup.dataUpdatedAt,
      })
    );
    expect(await readGistConnection()).toEqual({ accountId: 1, gistId: 'gist', enabled: false });
  }
);

it.each(['json', 'card', 'future'] as const)(
  'rejects a malformed %s import without writing and recovers',
  async (kind) => {
    await getRegisteredBackground().addCard(buildProblem());
    const before = await readLearningDocument();
    const invalid =
      kind === 'json'
        ? '{'
        : JSON.stringify(
            kind === 'future'
              ? { ...before, schemaVersion: LEARNING_DOCUMENT_VERSION + 1 }
              : { ...before, cards: { '1': { ...before.cards['1'], fsrs: { ...before.cards['1'].fsrs, state: 4 } } } }
          );
    const writes = vi.spyOn(fakeBrowser.storage.local, 'set');
    await expect(getRegisteredBackground().importData(invalid)).rejects.toThrow();
    expect(writes).not.toHaveBeenCalled();
    expect(await readLearningDocument()).toEqual(before);
    await getRegisteredBackground().saveNote('1', 'Recovered');
    expect((await readLearningDocument()).cards['1'].note).toBe('Recovered');
  }
);
