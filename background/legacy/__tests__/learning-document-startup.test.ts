import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fakeBrowser } from 'wxt/testing/fake-browser';
import { storage } from 'wxt/utils/storage';
import { initializeLearningDocument } from '@/background/legacy/learning-document-startup';
import { background } from '@/shared/background-service';
import { LEARNING_DOCUMENT_VERSION } from '@/shared/models';
import {
  readGistConnection,
  readLearningDocument,
  replaceLearningDocument,
  writeGistConnection,
} from '@/shared/storage';
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

  it.each(['missing', 'null'])('initializes an unedited installation with a %s document', async (presence) => {
    if (presence === 'null') {
      // The fake browser drops null values; expose raw null at the storage boundary.
      vi.spyOn(fakeBrowser.storage.local, 'get').mockImplementationOnce(async () => ({
        'leetsrs:learningDocument': null,
      }));
    }

    await initializeLearningDocument();

    expect(await readLearningDocument()).toEqual(
      buildLearningDocument({ settings: { resetEditorOnReviewQueue: false } })
    );
    expect(await readGistConnection()).toEqual({ accountId: null, gistId: null, enabled: false });
    expect(await storage.getItem('local:leetsrs:schemaVersion')).toBeNull();
    expect(Object.values(background).flatMap((method) => vi.mocked(method).mock.calls)).toHaveLength(0);
  });

  it.each([undefined, 3, 5])('preserves an installation at version %s', async (version) => {
    const { backup, converted, legacyConverted } = validLegacyBackup();
    const schemaVersion = version ?? 0;
    const cards = structuredClone(schemaVersion < 4 ? backup.data.cards : legacyConverted.cards);
    if (schemaVersion === 0) {
      Reflect.deleteProperty(cards['two-sum'], 'domain');
    }
    const local: Record<string, unknown> = {
      'leetsrs:cards': cards,
      'leetsrs:stats': backup.data.stats,
      'leetsrs:dataUpdatedAt': backup.dataUpdatedAt,
      'leetsrs:lastSyncTime': 'local-status',
      'leetsrs:lastSyncDirection': 'pull',
      unrelated: 'keep',
    };
    if (version !== undefined) {
      local['leetsrs:schemaVersion'] = version;
    }
    for (const [id, note] of Object.entries(backup.data.notes)) {
      local[`leetsrs:notes:${id}`] = note;
    }
    const sync = {
      'leetsrs:theme': 'light',
      'leetsrs:maxNewCardsPerDay': 0,
      'leetsrs:badgeEnabled': false,
      'leetsrs:resetEditorOnDueReview': false,
      [schemaVersion < 3 ? 'leetsrs:autoClearLeetcode' : 'leetsrs:resetEditorOnEveryProblem']: false,
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

  it.each([0, 6, 7])('treats a saved version %i document as authoritative', async (schemaVersion) => {
    const { backup, converted, legacyConverted } = validLegacyBackup();
    await fakeBrowser.storage.local.set({
      'leetsrs:learningDocument': {
        ...(schemaVersion < 4 ? backup.data : legacyConverted),
        schemaVersion,
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
          ...(schemaVersion < 7 && { resetEditorOnReviewQueue: false }),
        },
        dataUpdatedAt: backup.dataUpdatedAt,
      })
    );
    expect(await fakeBrowser.storage.sync.get()).toEqual({ 'leetsrs:gistConnection': 'do not read or replace' });
  });

  it.each([
    false,
    { schemaVersion: null },
    { schemaVersion: 5, cards: null },
    { schemaVersion: LEARNING_DOCUMENT_VERSION, cards: {}, stats: {} },
    { schemaVersion: LEARNING_DOCUMENT_VERSION + 1, cards: {}, stats: {}, settings: {} },
  ])('reports corrupt or future saved documents without legacy fallback: %j', async (document) => {
    await fakeBrowser.storage.local.set({
      'leetsrs:learningDocument': document,
      'leetsrs:cards': {},
      'leetsrs:schemaVersion': 5,
    });
    const before = await fakeBrowser.storage.local.get();
    const snapshots = vi.spyOn(storage, 'snapshot').mockRejectedValue(new Error('Must not gather legacy storage'));

    await expect(initializeLearningDocument()).rejects.toThrow();

    expect(snapshots).not.toHaveBeenCalled();
    expect(await fakeBrowser.storage.local.get()).toEqual(before);
    expect(await fakeBrowser.storage.sync.get()).toEqual({});
  });

  it.each(['document'])('retries a rejected %s write from intact legacy data', async (stage) => {
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
    const area = stage === 'promotion' ? fakeBrowser.storage.sync : fakeBrowser.storage.local;
    vi.spyOn(area, 'set').mockRejectedValueOnce(new Error('Storage unavailable'));

    await expect(initializeLearningDocument()).rejects.toThrow('Storage unavailable');

    expect(await storage.getItem('local:leetsrs:learningDocument')).toBeNull();
    expect(await fakeBrowser.storage.local.get()).toEqual(local);
    expect(await fakeBrowser.storage.sync.get()).toEqual({
      ...sync,
    });

    // A shared connection edit arriving before retry must win over the retained legacy fields.
    const shared = { accountId: null, gistId: null, enabled: false };
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

  it.each(['local', 'sync'] as const)('keeps the saved document authoritative after %s cleanup fails', async (area) => {
    const { converted, legacyConverted } = validLegacyBackup();
    await fakeBrowser.storage.local.set({ 'leetsrs:cards': legacyConverted.cards, 'leetsrs:schemaVersion': 5 });
    await fakeBrowser.storage.sync.set({ 'leetsrs:language': 'de', 'leetsrs:githubPat': 'secret' });
    vi.spyOn(fakeBrowser.storage[area], 'remove').mockRejectedValueOnce(new Error('Cleanup unavailable'));
    vi.spyOn(console, 'warn').mockImplementation(() => {});

    await initializeLearningDocument();

    expect(await readLearningDocument()).toEqual(
      buildLearningDocument({
        cards: converted.cards,
        settings: { language: 'en', resetEditorOnReviewQueue: false },
      })
    );
    expect(await readGistConnection()).toEqual({ accountId: null, gistId: null, enabled: false });

    // Editing the authoritative document then restarting must not resurrect retained legacy data.
    const edited = buildLearningDocument();
    await replaceLearningDocument(edited);
    await initializeLearningDocument();

    expect(await readLearningDocument()).toEqual(edited);
  });

  it.each([['sync', 'theme', 'invalid']])('rejects malformed %s %s before any writes', async (area, key, value) => {
    const { backup } = validLegacyBackup();
    const local: Record<string, unknown> = {
      'leetsrs:schemaVersion': 2,
      'leetsrs:cards': backup.data.cards,
      'leetsrs:notes:valid-com': backup.data.notes['valid-com'],
    };
    const sync: Record<string, unknown> = { 'leetsrs:githubPat': 'secret' };
    const invalidArea = area === 'local' ? local : sync;
    invalidArea[`leetsrs:${key}`] = value;
    await fakeBrowser.storage.local.set(local);
    await fakeBrowser.storage.sync.set(sync);
    const localBefore = await fakeBrowser.storage.local.get();
    const syncBefore = await fakeBrowser.storage.sync.get();
    // Preserve explicit nulls, which the fake browser otherwise drops, in the raw snapshots.
    vi.spyOn(storage, 'snapshot').mockImplementation(async (name) => structuredClone(name === 'local' ? local : sync));
    const localWrites = vi.spyOn(fakeBrowser.storage.local, 'set');
    const syncWrites = vi.spyOn(fakeBrowser.storage.sync, 'set');

    await expect(initializeLearningDocument()).rejects.toThrow();

    expect(localWrites).not.toHaveBeenCalled();
    expect(syncWrites).not.toHaveBeenCalled();
    expect(await fakeBrowser.storage.local.get()).toEqual(localBefore);
    expect(await fakeBrowser.storage.sync.get()).toEqual(syncBefore);
  });

  it.each([
    { pat: 'shared-secret', gistId: 'shared-gist', enabled: true },
    { pat: '', gistId: null, enabled: false },
    { pat: '', gistId: '', enabled: false },
  ])('preserves an already-combined connection over malformed retained fields: %j', async (connection) => {
    const sync = {
      'leetsrs:gistConnection': connection,
      'leetsrs:githubPat': 42,
      'leetsrs:gistId': false,
      'leetsrs:gistSyncEnabled': 'invalid',
    };
    await fakeBrowser.storage.sync.set(sync);

    await initializeLearningDocument();

    expect(await readGistConnection()).toEqual({ accountId: null, gistId: null, enabled: false });
    expect(await fakeBrowser.storage.sync.get()).toEqual(sync);
  });

  it('retries a rejected supported-document conversion without falling back to legacy storage', async () => {
    const { converted, legacyConverted, backup } = validLegacyBackup();
    const saved = { ...legacyConverted, schemaVersion: 5, dataUpdatedAt: backup.dataUpdatedAt };
    await fakeBrowser.storage.local.set({
      'leetsrs:learningDocument': saved,
      'leetsrs:cards': {},
      'leetsrs:dataUpdatedAt': '2025-01-01',
    });
    const before = await fakeBrowser.storage.local.get();
    vi.spyOn(fakeBrowser.storage.local, 'set').mockRejectedValueOnce(new Error('Write unavailable'));

    await expect(initializeLearningDocument()).rejects.toThrow('Write unavailable');
    expect(await fakeBrowser.storage.local.get()).toEqual(before);

    await initializeLearningDocument();

    expect(await readLearningDocument()).toEqual(
      buildLearningDocument({
        ...converted,
        dataUpdatedAt: backup.dataUpdatedAt,
        settings: { resetEditorOnReviewQueue: false },
      })
    );
    expect(await fakeBrowser.storage.sync.get()).toEqual({});
  });
});
