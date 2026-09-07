import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fakeBrowser } from 'wxt/testing/fake-browser';
import { storage } from 'wxt/utils/storage';
import { SETTING_KEYS } from '@/domain/settings';
import { STORAGE_KEYS } from '@/infrastructure/storage/storage-keys';
import { createDeferred } from '@/test/utils/deferred';
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
    cards: { imported: { id: 'new', unknownField: 'retained' } },
    stats: { arbitrary: { unknownField: 42 } },
    notes: { new: { text: 'new note', unknownField: true } },
    settings: { theme: 'dark' },
    gistSync: { gistId: 'incoming-gist', enabled: false },
  },
};

async function seedExistingData(pat = 'existing-pat') {
  await storage.setItem(STORAGE_KEYS.cards, { old: { id: 'old' } });
  await storage.setItem(STORAGE_KEYS.stats, { old: {} });
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

  it('exports exact raw records and JSON formatting, omitting credentials and orphan notes', async () => {
    await seedExistingData();
    await storage.setItem(STORAGE_KEYS.cards, payload.data.cards);
    await storage.setItem(STORAGE_KEYS.stats, payload.data.stats);
    await storage.setItem(newNoteKey, payload.data.notes.new);
    await storage.setItem(STORAGE_KEYS.theme, 'invalid-theme');
    await storage.setItem(STORAGE_KEYS.gistSyncEnabled, false);
    await storage.setItem(STORAGE_KEYS.lastSyncTime, 'private-sync-time');

    expect(await exportData()).toBe(
      JSON.stringify(
        {
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
        },
        null,
        2
      )
    );
  });

  it('samples export time only after the final schema read completes', async () => {
    const schema = createDeferred<number>();
    const read = storage.getItem.bind(storage);
    vi.spyOn(storage, 'getItem').mockImplementation((key, options) =>
      key === STORAGE_KEYS.schemaVersion ? schema.promise : read(key, options)
    );
    const exporting = exportData();
    await vi.waitFor(() => expect(storage.getItem).toHaveBeenCalledWith(STORAGE_KEYS.schemaVersion));
    vi.setSystemTime(new Date(incomingTime));
    schema.resolve(2);
    expect(JSON.parse(await exporting).exportDate).toBe(incomingTime);
  });

  it('rejects malformed input before schema I/O and validates records only after it succeeds', async () => {
    const failure = new Error('schema unavailable');
    const read = vi.spyOn(storage, 'getItem').mockRejectedValue(failure);
    await expect(prepareImportData('invalid json')).rejects.toThrow('Invalid JSON format');
    await expect(prepareImportData('{}')).rejects.toThrow('Invalid export data structure');
    expect(read).not.toHaveBeenCalled();

    await expect(
      prepareImportData(
        JSON.stringify({
          ...payload,
          data: { ...payload.data, cards: null },
        })
      )
    ).rejects.toBe(failure);
    expect(read).toHaveBeenCalledExactlyOnceWith(STORAGE_KEYS.schemaVersion);
  });

  it('generates a missing import timestamp after the schema read, preserving an empty timestamp', async () => {
    const schema = createDeferred<number>();
    const read = storage.getItem.bind(storage);
    vi.spyOn(storage, 'getItem').mockImplementation((key, options) =>
      key === STORAGE_KEYS.schemaVersion ? schema.promise : read(key, options)
    );
    const preparing = prepareImportData(JSON.stringify({ ...payload, dataUpdatedAt: undefined }));
    vi.setSystemTime(new Date(incomingTime));
    schema.resolve(2);
    expect((await preparing).dataUpdatedAt).toBe(incomingTime);
    expect((await prepareImportData(JSON.stringify({ ...payload, dataUpdatedAt: '' }))).dataUpdatedAt).toBe('');
  });

  it('resets before restoration and overwrites the settings timestamp with the imported timestamp', async () => {
    await seedExistingData();
    const events: string[] = [];
    const remove = storage.removeItem.bind(storage);
    const write = storage.setItem.bind(storage);
    vi.spyOn(storage, 'removeItem').mockImplementation(async (key, options) => {
      events.push(`remove:${key}`);
      return remove(key, options);
    });
    const writes = vi.spyOn(storage, 'setItem').mockImplementation(async (key, value) => {
      events.push(`write:${key}`);
      return write(key, value);
    });

    await importData(JSON.stringify(payload));

    expect(events).toEqual([
      `remove:${STORAGE_KEYS.cards}`,
      `remove:${STORAGE_KEYS.stats}`,
      ...SETTING_KEYS.map((key) => `remove:${STORAGE_KEYS[key]}`),
      ...['githubPat', 'gistId', 'gistSyncEnabled', 'lastSyncTime', 'lastSyncDirection', 'dataUpdatedAt'].map(
        (key) => `remove:${STORAGE_KEYS[key as keyof typeof STORAGE_KEYS]}`
      ),
      `remove:${oldNoteKey}`,
      ...['githubPat', 'cards', 'stats'].map((key) => `write:${STORAGE_KEYS[key as keyof typeof STORAGE_KEYS]}`),
      `write:${newNoteKey}`,
      ...['theme', 'dataUpdatedAt', 'gistId', 'gistSyncEnabled', 'dataUpdatedAt'].map(
        (key) => `write:${STORAGE_KEYS[key as keyof typeof STORAGE_KEYS]}`
      ),
    ]);
    expect(writes.mock.calls.filter(([key]) => key === STORAGE_KEYS.dataUpdatedAt)).toEqual([
      [STORAGE_KEYS.dataUpdatedAt, now],
      [STORAGE_KEYS.dataUpdatedAt, incomingTime],
    ]);
    expect(await storage.getItem(orphanNoteKey)).toEqual({ text: 'orphan note' });
    expect(await storage.getItem(STORAGE_KEYS.schemaVersion)).toBe(2);
  });

  it.each([
    [STORAGE_KEYS.stats, 'existing-pat', 'old-time'],
    [oldNoteKey, null, null],
  ] as const)('retains partial reset state when removing %s fails', async (failedKey, pat, timestamp) => {
    await seedExistingData();
    const failure = new Error('reset failed');
    const remove = storage.removeItem.bind(storage);
    vi.spyOn(storage, 'removeItem').mockImplementation(async (key, options) => {
      if (key === failedKey) throw failure;
      return remove(key, options);
    });
    const writes = vi.spyOn(storage, 'setItem');

    await expect(importData(JSON.stringify(payload))).rejects.toBe(failure);

    expect(writes).not.toHaveBeenCalled();
    expect(await storage.getItem(STORAGE_KEYS.cards)).toBeNull();
    expect(await storage.getItem(STORAGE_KEYS.githubPat)).toBe(pat);
    expect(await storage.getItem(STORAGE_KEYS.dataUpdatedAt)).toBe(timestamp);
    expect(await storage.getItem(oldNoteKey)).toEqual({ text: 'old note' });
  });

  it.each([STORAGE_KEYS.githubPat, STORAGE_KEYS.stats, STORAGE_KEYS.gistId])(
    'stops restoration at a failed %s write without rollback',
    async (failedKey) => {
      await seedExistingData();
      const failure = new Error('restore failed');
      const write = storage.setItem.bind(storage);
      vi.spyOn(storage, 'setItem').mockImplementation(async (key, value) => {
        if (key === failedKey) throw failure;
        return write(key, value);
      });

      await expect(importData(JSON.stringify(payload))).rejects.toBe(failure);

      expect(await storage.getItem(oldNoteKey)).toBeNull();
      expect(await storage.getItem(STORAGE_KEYS.githubPat)).toBe(
        failedKey === STORAGE_KEYS.githubPat ? null : 'existing-pat'
      );
      expect(await storage.getItem(STORAGE_KEYS.cards)).toEqual(
        failedKey === STORAGE_KEYS.githubPat ? null : payload.data.cards
      );
      expect(await storage.getItem(STORAGE_KEYS.dataUpdatedAt)).toBe(failedKey === STORAGE_KEYS.gistId ? now : null);
      expect(await storage.getItem(STORAGE_KEYS.gistSyncEnabled)).toBeNull();
    }
  );

  it.each([null, '', 'existing-pat'])(
    'preserves only a truthy local PAT (%s), ignoring imported credentials',
    async (pat) => {
      if (pat !== null) await storage.setItem(STORAGE_KEYS.githubPat, pat);
      await importData(
        JSON.stringify({ ...payload, data: { ...payload.data, gistSync: { githubPat: 'untrusted-pat' } } })
      );
      expect(await storage.getItem(STORAGE_KEYS.githubPat)).toBe(pat || null);
      expect(await storage.getItem(STORAGE_KEYS.gistId)).toBeNull();
      expect(await storage.getItem(STORAGE_KEYS.gistSyncEnabled)).toBeNull();
    }
  );

  it('standalone reset removes the PAT and sync timestamp but preserves schema and orphan notes', async () => {
    await seedExistingData();
    await resetAllData();
    expect(await storage.getItem(STORAGE_KEYS.githubPat)).toBeNull();
    expect(await storage.getItem(STORAGE_KEYS.dataUpdatedAt)).toBeNull();
    expect(await storage.getItem(STORAGE_KEYS.schemaVersion)).toBe(2);
    expect(await storage.getItem(orphanNoteKey)).toEqual({ text: 'orphan note' });
  });
});
