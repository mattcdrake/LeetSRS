import { createEmptyCard } from 'ts-fsrs';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fakeBrowser } from 'wxt/testing/fake-browser';
import { storage } from 'wxt/utils/storage';
import { createDailyStats } from '@/domain/statistics';
import { STORAGE_KEYS } from '@/infrastructure/storage/storage-keys';
import { buildProblem } from '@/test/utils/card-mocks';
import { exportData, importData, prepareImportData, resetAllData } from '../import-export';

const now = '2026-09-06T12:00:00.000Z';
const incomingTime = '2024-01-01T00:00:00.000Z';
const oldNoteKey = `${STORAGE_KEYS.notes}:old` as const;
const newNoteKey = `${STORAGE_KEYS.notes}:new` as const;
const orphanNoteKey = `${STORAGE_KEYS.notes}:orphan` as const;
const payload = {
  exportDate: incomingTime,
  dataUpdatedAt: incomingTime,
  data: {
    cards: {
      imported: {
        ...buildProblem({ slug: 'imported' }),
        id: 'new',
        createdAt: Date.parse(incomingTime),
        paused: false,
        fsrs: { ...createEmptyCard(new Date(incomingTime)), due: Date.parse(incomingTime) },
      },
    },
    stats: { '2024-01-01': createDailyStats('2024-01-01', undefined) },
    notes: { new: { text: 'new note' } },
    settings: { theme: 'dark' },
    gistSync: { gistId: 'incoming-gist', enabled: false },
  },
};

async function seedExistingData(pat = 'existing-pat') {
  await storage.setItem(STORAGE_KEYS.cards, { old: { ...payload.data.cards.imported, id: 'old', slug: 'old' } });
  await storage.setItem(STORAGE_KEYS.stats, { '2024-01-01': createDailyStats('2024-01-01', undefined) });
  await storage.setItem(oldNoteKey, { text: 'old note' });
  await storage.setItem(orphanNoteKey, { text: 'orphan note' });
  await storage.setItem(STORAGE_KEYS.githubPat, pat);
  await storage.setItem(STORAGE_KEYS.gistId, 'old-gist');
  await storage.setItem(STORAGE_KEYS.dataUpdatedAt, 'old-time');
  await storage.setItem(STORAGE_KEYS.schemaVersion, 2);
}

describe('backup workflow characterization', () => {
  beforeEach(() => {
    fakeBrowser.reset();
    fakeBrowser.runtime.id = 'test';
    vi.useFakeTimers();
    vi.setSystemTime(new Date(now));
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.useRealTimers();
    fakeBrowser.reset();
  });

  it('exports supported records, omitting credentials and orphan notes', async () => {
    await seedExistingData();
    await storage.setItem(STORAGE_KEYS.cards, payload.data.cards);
    await storage.setItem(STORAGE_KEYS.stats, payload.data.stats);
    await storage.setItem(newNoteKey, payload.data.notes.new);
    await storage.setItem(STORAGE_KEYS.theme, 'invalid-theme');
    await storage.setItem(STORAGE_KEYS.gistSyncEnabled, false);
    await storage.setItem(STORAGE_KEYS.lastSyncTime, 'private-sync-time');
    expect(JSON.parse(await exportData())).toEqual({
      schemaVersion: 2,
      exportDate: now,
      dataUpdatedAt: 'old-time',
      data: {
        cards: payload.data.cards,
        stats: payload.data.stats,
        notes: payload.data.notes,
        settings: {},
        gistSync: { gistId: 'old-gist', enabled: false },
      },
    });
  });

  it('propagates schema-read failures without changing existing data', async () => {
    await seedExistingData();
    const failure = new Error('schema unavailable');
    const read = storage.getItem.bind(storage);
    vi.spyOn(storage, 'getItem').mockImplementation((key, options) =>
      key === STORAGE_KEYS.schemaVersion ? Promise.reject(failure) : read(key, options)
    );
    const before = await fakeBrowser.storage.local.get(null);

    await expect(importData(JSON.stringify(payload))).rejects.toBe(failure);
    expect(await fakeBrowser.storage.local.get(null)).toEqual(before);
  });

  it('generates a missing import timestamp and rejects an empty timestamp', async () => {
    expect((await prepareImportData(JSON.stringify({ ...payload, dataUpdatedAt: undefined }))).dataUpdatedAt).toBe(now);
    await expect(prepareImportData(JSON.stringify({ ...payload, dataUpdatedAt: '' }))).rejects.toThrow(
      'Invalid update timestamp'
    );
  });

  it('replaces learning data and settings while preserving the local PAT and schema', async () => {
    await seedExistingData();
    await storage.setItem(STORAGE_KEYS.theme, 'light');
    await storage.setItem(STORAGE_KEYS.maxNewCardsPerDay, 12);

    await importData(JSON.stringify(payload));

    expect(await storage.getItem(STORAGE_KEYS.cards)).toEqual(payload.data.cards);
    expect(await storage.getItem(STORAGE_KEYS.stats)).toEqual(payload.data.stats);
    expect(await storage.getItem(newNoteKey)).toEqual(payload.data.notes.new);
    expect(await storage.getItem(oldNoteKey)).toBeNull();
    expect(await storage.getItem(STORAGE_KEYS.theme)).toBe('dark');
    expect(await storage.getItem(STORAGE_KEYS.maxNewCardsPerDay)).toBeNull();
    expect(await storage.getItem(STORAGE_KEYS.dataUpdatedAt)).toBe(incomingTime);
    expect(await storage.getItem(STORAGE_KEYS.githubPat)).toBe('existing-pat');
    expect(await storage.getItem(STORAGE_KEYS.schemaVersion)).toBe(2);
  });

  it('reports a failure to remove the previous dataset', async () => {
    await seedExistingData();
    const failure = new Error('reset failed');
    const remove = storage.removeItem.bind(storage);
    vi.spyOn(storage, 'removeItem').mockImplementation((key, options) =>
      key === STORAGE_KEYS.cards ? Promise.reject(failure) : remove(key, options)
    );

    await expect(importData(JSON.stringify(payload))).rejects.toBe(failure);
  });

  it.each([STORAGE_KEYS.cards, STORAGE_KEYS.stats, newNoteKey, STORAGE_KEYS.theme, STORAGE_KEYS.dataUpdatedAt])(
    'reports a failed import write to %s',
    async (failedKey) => {
      await seedExistingData();
      const failure = new Error('import write failed');
      const write = storage.setItem.bind(storage);
      vi.spyOn(storage, 'setItem').mockImplementation((key, value) =>
        key === failedKey ? Promise.reject(failure) : write(key, value)
      );

      await expect(importData(JSON.stringify(payload))).rejects.toBe(failure);
    }
  );

  it.each([null, 'existing-pat'])('ignores imported credentials when the local PAT is %s', async (pat) => {
    if (pat !== null) await storage.setItem(STORAGE_KEYS.githubPat, pat);
    await importData(
      JSON.stringify({ ...payload, data: { ...payload.data, gistSync: { githubPat: 'untrusted-pat' } } })
    );
    expect(await storage.getItem(STORAGE_KEYS.githubPat)).toBe(pat || null);
  });

  it('standalone reset removes learning data and credentials while preserving the schema', async () => {
    await seedExistingData();
    await resetAllData();
    expect(await storage.getItem(STORAGE_KEYS.githubPat)).toBeNull();
    expect(await storage.getItem(STORAGE_KEYS.dataUpdatedAt)).toBeNull();
    expect(await storage.getItem(STORAGE_KEYS.schemaVersion)).toBe(2);
    expect(await storage.getItem(STORAGE_KEYS.cards)).toBeNull();
    expect(await storage.getItem(STORAGE_KEYS.stats)).toBeNull();
    expect(await storage.getItem(oldNoteKey)).toBeNull();
  });
});
