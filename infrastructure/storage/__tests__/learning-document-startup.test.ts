import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fakeBrowser } from 'wxt/testing/fake-browser';
import { storage } from 'wxt/utils/storage';
import { mixedRecordBackup } from '@/test/utils/backup-mocks';
import { readGistConnection, writeGistConnection } from '../gist-connection';
import { readLearningDocument, replaceLearningDocument } from '../learning-document';
import { initializeLearningDocument } from '../learning-document-startup';

describe('learning document startup', () => {
  beforeEach(() => fakeBrowser.reset());

  it.each(['missing', 'null'])('initializes an unedited installation with a %s document', async (presence) => {
    if (presence === 'null') {
      // The fake browser drops null values; expose raw null at the storage boundary.
      vi.spyOn(fakeBrowser.storage.local, 'get').mockImplementationOnce(async () => ({
        'leetsrs:learningDocument': null,
      }));
    }

    await initializeLearningDocument();

    expect(await readLearningDocument()).toEqual({ schemaVersion: 6, cards: {}, stats: {}, settings: {} });
    expect(await readGistConnection()).toEqual({ pat: '', gistId: null, enabled: false });
    expect(await storage.getItem('local:leetsrs:schemaVersion')).toBeNull();
  });

  it.each([undefined, 0, 1, 2, 3, 4, 5])('preserves an installation at version %s', async (version) => {
    const { accepted, embedded, payload } = mixedRecordBackup();
    const schemaVersion = version ?? 0;
    const cards = structuredClone(schemaVersion < 4 ? accepted.cards : embedded.cards);
    if (schemaVersion === 0) {
      Reflect.deleteProperty(cards['two-sum'], 'domain');
    }
    const local: Record<string, unknown> = {
      'leetsrs:cards': cards,
      'leetsrs:stats': accepted.stats,
      'leetsrs:dataUpdatedAt': payload.dataUpdatedAt,
      'leetsrs:lastSyncTime': 'local-status',
      'leetsrs:lastSyncDirection': 'pull',
      unrelated: 'keep',
    };
    if (version !== undefined) {
      local['leetsrs:schemaVersion'] = version;
    }
    for (const [id, note] of Object.entries(accepted.notes)) {
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

    const expected = {
      schemaVersion: 6,
      ...embedded,
      dataUpdatedAt: payload.dataUpdatedAt,
      settings: {
        theme: 'light',
        maxNewCardsPerDay: 0,
        badgeEnabled: false,
        resetEditorOnDueReview: false,
        resetEditorOnEveryProblem: false,
      },
    };
    expect(await readLearningDocument()).toEqual(expected);
    expect(await readGistConnection()).toEqual({ pat: ' token ', gistId: 'legacy-gist', enabled: true });
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
      'leetsrs:gistConnection': { pat: ' token ', gistId: 'legacy-gist', enabled: true },
      unrelated: 'keep',
    });
  });

  it.each([0, 1, 2, 3, 4, 5, 6])('treats a saved version %i document as authoritative', async (schemaVersion) => {
    const { accepted, embedded, payload } = mixedRecordBackup();
    await fakeBrowser.storage.local.set({
      'leetsrs:learningDocument': {
        ...(schemaVersion < 4 ? accepted : embedded),
        schemaVersion,
        settings: { language: 'de' },
        dataUpdatedAt: payload.dataUpdatedAt,
      },
      'leetsrs:cards': 'invalid stale cards',
      'leetsrs:schemaVersion': 'invalid stale version',
    });
    await fakeBrowser.storage.sync.set({ 'leetsrs:gistConnection': 'do not read or replace' });
    vi.spyOn(storage, 'snapshot').mockRejectedValue(new Error('Must not gather legacy storage'));

    await initializeLearningDocument();

    expect(await readLearningDocument()).toEqual({
      ...embedded,
      schemaVersion: 6,
      settings: { language: 'de' },
      dataUpdatedAt: payload.dataUpdatedAt,
    });
    expect(await fakeBrowser.storage.sync.get()).toEqual({ 'leetsrs:gistConnection': 'do not read or replace' });
  });

  it.each([
    false,
    0,
    '',
    { invalid: [] },
    {},
    { schemaVersion: null },
    { schemaVersion: 5, cards: null },
    { schemaVersion: 6, cards: {}, stats: {} },
    { schemaVersion: 7, cards: {}, stats: {}, settings: {} },
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

  it.each(['promotion', 'document'])('retries a rejected %s write from intact legacy data', async (stage) => {
    const { accepted, embedded, payload } = mixedRecordBackup();
    const local = {
      'leetsrs:schemaVersion': 2,
      'leetsrs:cards': accepted.cards,
      'leetsrs:stats': accepted.stats,
      'leetsrs:notes:valid-com': accepted.notes['valid-com'],
      'leetsrs:dataUpdatedAt': payload.dataUpdatedAt,
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

    await expect(readLearningDocument()).rejects.toThrow('Learning document is not initialized');
    expect(await fakeBrowser.storage.local.get()).toEqual(local);
    expect(await fakeBrowser.storage.sync.get()).toEqual({
      ...sync,
      ...(stage === 'document' && {
        'leetsrs:gistConnection': { pat: 'legacy-secret', gistId: 'legacy-gist', enabled: true },
      }),
    });

    // A shared connection edit arriving before retry must win over the retained legacy fields.
    const shared = { pat: '', gistId: null, enabled: false };
    await writeGistConnection(shared);
    await initializeLearningDocument();

    expect(await readLearningDocument()).toEqual({
      ...embedded,
      schemaVersion: 6,
      dataUpdatedAt: payload.dataUpdatedAt,
      settings: { theme: 'dark', resetEditorOnEveryProblem: false },
    });
    expect(await readGistConnection()).toEqual(shared);
  });

  it.each(['local', 'sync'] as const)('keeps the saved document authoritative after %s cleanup fails', async (area) => {
    const { embedded } = mixedRecordBackup();
    await fakeBrowser.storage.local.set({ 'leetsrs:cards': embedded.cards, 'leetsrs:schemaVersion': 5 });
    await fakeBrowser.storage.sync.set({ 'leetsrs:language': 'de', 'leetsrs:githubPat': 'secret' });
    vi.spyOn(fakeBrowser.storage[area], 'remove').mockRejectedValueOnce(new Error('Cleanup unavailable'));
    vi.spyOn(console, 'warn').mockImplementation(() => {});

    await initializeLearningDocument();

    expect(await readLearningDocument()).toEqual({
      schemaVersion: 6,
      cards: embedded.cards,
      stats: {},
      settings: { language: 'de' },
    });
    expect(await readGistConnection()).toEqual({ pat: 'secret', gistId: null, enabled: false });

    // Editing the authoritative document then restarting must not resurrect retained legacy data.
    const edited = { schemaVersion: 6 as const, cards: {}, stats: {}, settings: {} };
    await replaceLearningDocument(edited);
    await initializeLearningDocument();

    expect(await readLearningDocument()).toEqual(edited);
  });

  it.each([
    ['local', 'schemaVersion', null],
    ['local', 'schemaVersion', '2'],
    ['local', 'schemaVersion', 6],
    ['local', 'cards', null],
    ['local', 'stats', []],
    ['local', 'dataUpdatedAt', null],
    ['local', 'notes:valid-com', { text: 42 }],
    ['sync', 'theme', null],
    ['sync', 'githubPat', 42],
    ['sync', 'gistId', false],
    ['sync', 'gistSyncEnabled', 'true'],
    ['sync', 'gistConnection', null],
    ['sync', 'gistConnection', {}],
  ])('rejects malformed %s %s before any writes', async (area, key, value) => {
    const { accepted } = mixedRecordBackup();
    const local: Record<string, unknown> = {
      'leetsrs:schemaVersion': 2,
      'leetsrs:cards': accepted.cards,
      'leetsrs:notes:valid-com': accepted.notes['valid-com'],
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

    expect(await readGistConnection()).toEqual(connection);
    expect(await fakeBrowser.storage.sync.get()).toEqual(sync);
  });

  it.each(['', ' \t\n '])('preserves embedded-note and modern-setting precedence for note %j', async (note) => {
    const { accepted } = mixedRecordBackup();
    const card = accepted.cards['two-sum'];
    await fakeBrowser.storage.local.set({
      'leetsrs:schemaVersion': 2,
      'leetsrs:cards': { 'two-sum': { ...card, note } },
      'leetsrs:notes:valid-com': { text: 'Stale note' },
    });
    await fakeBrowser.storage.sync.set({
      'leetsrs:dayStartHour': 4,
      'leetsrs:autoClearLeetcode': 'ignored',
      'leetsrs:resetEditorOnEveryProblem': false,
      'leetsrs:language': 'de',
    });

    await initializeLearningDocument();

    expect(await readLearningDocument()).toEqual({
      schemaVersion: 6,
      cards: { 'two-sum': { ...card, ...(note && { note }) } },
      stats: {},
      settings: { resetEditorOnEveryProblem: false, language: 'de' },
    });
  });

  it('retries a rejected supported-document conversion without falling back to legacy storage', async () => {
    const { embedded, payload } = mixedRecordBackup();
    const saved = { ...embedded, schemaVersion: 5, dataUpdatedAt: payload.dataUpdatedAt };
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

    expect(await readLearningDocument()).toEqual({ ...saved, schemaVersion: 6, settings: {} });
    expect(await fakeBrowser.storage.sync.get()).toEqual({});
  });
});
