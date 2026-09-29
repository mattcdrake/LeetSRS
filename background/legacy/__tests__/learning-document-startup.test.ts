import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fakeBrowser } from 'wxt/testing/fake-browser';
import { storage } from 'wxt/utils/storage';
import { initializeLearningDocument } from '@/background/legacy/learning-document-startup';
import { background } from '@/shared/background-service';
import { readGistConnection, writeGistConnection } from '@/shared/gist-sync';
import { learningDocumentItem, readLearningDocument } from '@/shared/learning-document';
import { validLegacyBackup } from '@/test/utils/backup-mocks';
import { buildLearningDocument } from '@/test/utils/learning-document-mocks';

vi.mock('@/shared/background-service');

describe('learning document startup', () => {
  beforeEach(() => {
    fakeBrowser.reset();
    vi.mocked(background.waitForInitialization).mockImplementation(async () => {
      throw new Error('Startup must not request readiness');
    });
  });

  it('migrates an unversioned installation without losing notes or settings', async () => {
    const { backup, converted } = validLegacyBackup();
    const cards = structuredClone(backup.data.cards);
    Reflect.deleteProperty(cards['two-sum'], 'domain');
    const local: Record<string, unknown> = {
      'leetsrs:cards': cards,
      'leetsrs:stats': backup.data.stats,
      'leetsrs:dataUpdatedAt': backup.dataUpdatedAt,
      'leetsrs:lastSyncTime': 'local-status',
      'leetsrs:lastSyncDirection': 'pull',
      unrelated: 'keep',
    };
    for (const [id, note] of Object.entries(backup.data.notes)) {
      local[`leetsrs:notes:${id}`] = note;
    }
    const sync = {
      'leetsrs:theme': 'light',
      'leetsrs:maxNewCardsPerDay': 0,
      'leetsrs:badgeEnabled': false,
      'leetsrs:resetEditorOnDueReview': false,
      'leetsrs:autoClearLeetcode': false,
      'leetsrs:githubPat': ' token ',
      'leetsrs:gistId': 'legacy-gist',
      'leetsrs:gistSyncEnabled': true,
      unrelated: 'keep',
    };
    await fakeBrowser.storage.local.set(local);
    await fakeBrowser.storage.sync.set(sync);

    await initializeLearningDocument();

    const expected = buildLearningDocument({
      ...converted,
      dataUpdatedAt: backup.dataUpdatedAt,
      settings: {
        theme: 'light',
        maxNewCardsPerDay: 0,
        resetEditorOnReviewQueue: false,
      },
    });
    expect(await readLearningDocument()).toEqual(expected);
    expect(await readGistConnection()).toEqual({ accountId: null, gistId: null, enabled: false });
    expect(await fakeBrowser.storage.local.get()).toEqual({
      'leetsrs:learningDocument': expected,
      'leetsrs:lastSyncTime': 'local-status',
      'leetsrs:lastSyncDirection': 'pull',
      unrelated: 'keep',
    });
    expect(await fakeBrowser.storage.sync.get()).toEqual({
      'leetsrs:githubPat': ' token ',
      'leetsrs:gistId': 'legacy-gist',
      'leetsrs:gistSyncEnabled': true,
      unrelated: 'keep',
    });
  });

  it('treats a saved document as authoritative over stale legacy storage', async () => {
    const { backup, converted, legacyConverted } = validLegacyBackup();
    await fakeBrowser.storage.local.set({
      'leetsrs:learningDocument': {
        ...legacyConverted,
        schemaVersion: 7,
        settings: { language: 'de' },
        dataUpdatedAt: backup.dataUpdatedAt,
      },
      'leetsrs:cards': 'invalid stale cards',
      'leetsrs:schemaVersion': 'invalid stale version',
    });
    await fakeBrowser.storage.sync.set({ 'leetsrs:gistConnection': 'do not read or replace' });
    vi.spyOn(storage, 'snapshot').mockRejectedValue(new Error('Must not gather legacy storage'));

    await initializeLearningDocument();

    expect(await readLearningDocument()).toEqual(
      buildLearningDocument({
        ...converted,
        settings: {
          language: 'en',
        },
        dataUpdatedAt: backup.dataUpdatedAt,
      })
    );
    expect(await fakeBrowser.storage.sync.get()).toEqual({ 'leetsrs:gistConnection': 'do not read or replace' });
  });

  it('retries a rejected document write from intact legacy data', async () => {
    const { backup, converted } = validLegacyBackup();
    const local = {
      'leetsrs:schemaVersion': 2,
      'leetsrs:cards': backup.data.cards,
      'leetsrs:stats': backup.data.stats,
      'leetsrs:notes:valid-com': backup.data.notes['valid-com'],
      'leetsrs:dataUpdatedAt': backup.dataUpdatedAt,
    };
    const sync = {
      'leetsrs:theme': 'dark',
      'leetsrs:autoClearLeetcode': false,
      'leetsrs:githubPat': 'legacy-secret',
      'leetsrs:gistId': 'legacy-gist',
      'leetsrs:gistSyncEnabled': true,
    };
    await fakeBrowser.storage.local.set(local);
    await fakeBrowser.storage.sync.set(sync);
    vi.spyOn(fakeBrowser.storage.local, 'set').mockRejectedValueOnce(new Error('Storage unavailable'));

    await expect(initializeLearningDocument()).rejects.toThrow('Storage unavailable');

    expect(await learningDocumentItem.getValue()).toBeNull();
    expect(await fakeBrowser.storage.local.get()).toEqual(local);
    expect(await fakeBrowser.storage.sync.get()).toEqual({
      ...sync,
    });

    // A shared connection edit arriving before retry must win over the retained legacy fields.
    const shared = { accountId: null, gistId: null, enabled: false } as const;
    await writeGistConnection(shared);
    await initializeLearningDocument();

    expect(await readLearningDocument()).toEqual(
      buildLearningDocument({
        ...converted,
        dataUpdatedAt: backup.dataUpdatedAt,
        settings: { theme: 'dark', resetEditorOnReviewQueue: false },
      })
    );
    expect(await readGistConnection()).toEqual(shared);
  });
});
