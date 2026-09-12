import { State } from 'ts-fsrs';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fakeBrowser } from 'wxt/testing/fake-browser';
import { storage } from 'wxt/utils/storage';
import { LEARNING_DOCUMENT_VERSION, type LearningDocument } from '@/domain/learning-document';
import { readGistConnection, writeGistConnection } from '@/infrastructure/storage/gist-connection';
import { readLearningDocument, replaceLearningDocument } from '@/infrastructure/storage/learning-document';
import { STORAGE_KEYS } from '@/infrastructure/storage/storage-keys';
import { mixedRecordBackup } from '@/test/utils/backup-mocks';
import { createMockCard } from '@/test/utils/card-mocks';
import * as documentBackup from '../import-export';

describe('document import-export', () => {
  const timestamp = '2024-01-15T10:00:00.000Z';
  const connection = { pat: 'private-pat', gistId: 'local-gist', enabled: true };

  beforeEach(async () => {
    fakeBrowser.reset();
    const get = fakeBrowser.storage.local.get.bind(fakeBrowser.storage.local);
    vi.spyOn(fakeBrowser.storage.local, 'get').mockImplementation(async (keys) => structuredClone(await get(keys)));
    await writeGistConnection(connection);
    await storage.setItem(STORAGE_KEYS.lastSyncTime, 'previous-sync');
    await storage.setItem(STORAGE_KEYS.lastSyncDirection, 'pull');
  });

  it('round-trips the complete captured document without connection or status fields', async () => {
    const { embedded } = mixedRecordBackup();
    const document: LearningDocument = {
      schemaVersion: LEARNING_DOCUMENT_VERSION,
      ...embedded,
      settings: { theme: 'dark', maxNewCardsPerDay: 7 },
      dataUpdatedAt: timestamp,
    };
    await replaceLearningDocument(document);
    // Stale scattered keys must not become part of the exported snapshot.
    await storage.setItem(STORAGE_KEYS.theme, 'light');
    const reads = vi.spyOn(storage, 'getItem');
    const json = await documentBackup.exportData();
    expect(reads.mock.calls.map(([key]) => key)).toEqual([STORAGE_KEYS.learningDocument]);
    expect(JSON.parse(json)).toEqual(document);

    await documentBackup.importData(JSON.stringify({ ...document, cards: {}, settings: {} }));
    await documentBackup.importData(json);
    expect(await readLearningDocument()).toEqual(document);
    expect(await readGistConnection()).toEqual(connection);
    expect(await storage.getItem(STORAGE_KEYS.lastSyncTime)).toBe('previous-sync');
    expect(await storage.getItem(STORAGE_KEYS.lastSyncDirection)).toBe('pull');
  });

  it.each([undefined, 0, 1, 2, 3, 4, 5])(
    'round-trips historical version %s with stored settings and the export-time fallback',
    async (schemaVersion) => {
      const { accepted, embedded } = mixedRecordBackup();
      const settings =
        schemaVersion === undefined || schemaVersion < 3
          ? { autoClearLeetcode: false, dayStartHour: 4, theme: 'dark' }
          : { resetEditorOnEveryProblem: false, theme: 'dark' };
      const data = schemaVersion !== undefined && schemaVersion >= 4 ? embedded : accepted;
      await documentBackup.importData(
        JSON.stringify({
          schemaVersion,
          exportDate: timestamp,
          data: { ...data, settings, gistSync: { gistId: 'incoming', enabled: false, pat: 'incoming-pat' } },
        })
      );
      const expected = {
        schemaVersion: LEARNING_DOCUMENT_VERSION,
        ...embedded,
        settings: { resetEditorOnEveryProblem: false, theme: 'dark' },
        dataUpdatedAt: timestamp,
      };
      expect(JSON.parse(await documentBackup.exportData())).toEqual(expected);
      await documentBackup.importData(await documentBackup.exportData());
      expect(await readLearningDocument()).toEqual(expected);
      expect(await readGistConnection()).toEqual(connection);
      expect(await storage.getItem(STORAGE_KEYS.lastSyncTime)).toBe('previous-sync');
    }
  );

  it.each(['current', 'historical'])(
    'replaces omitted notes and settings from a %s backup in one write',
    async (format) => {
      const card = createMockCard(State.New, { slug: 'two-sum' });
      await replaceLearningDocument({
        schemaVersion: LEARNING_DOCUMENT_VERSION,
        cards: { 'two-sum': { ...card, note: 'old note' } },
        stats: {},
        settings: { theme: 'dark', language: 'zh-CN' },
        dataUpdatedAt: timestamp,
      });
      const data = { cards: { 'two-sum': card }, stats: {} };
      const input =
        format === 'current'
          ? { schemaVersion: LEARNING_DOCUMENT_VERSION, ...data, settings: {} }
          : { schemaVersion: 5, exportDate: timestamp, dataUpdatedAt: '2023-01-01', data };
      const writes = vi.spyOn(storage, 'setItem');
      await documentBackup.importData(JSON.stringify(input));
      const expected = {
        schemaVersion: LEARNING_DOCUMENT_VERSION,
        ...data,
        settings: {},
        ...(format === 'historical' && { dataUpdatedAt: '2023-01-01' }),
      };
      expect(writes).toHaveBeenCalledExactlyOnceWith(STORAGE_KEYS.learningDocument, expected);
      expect(JSON.parse(await documentBackup.exportData())).toEqual(expected);
      expect(await readGistConnection()).toEqual(connection);
      expect(await storage.getItem(STORAGE_KEYS.lastSyncTime)).toBe('previous-sync');
      expect(await storage.getItem(STORAGE_KEYS.lastSyncDirection)).toBe('pull');
    }
  );

  it.each(['preparation', 'replacement'])(
    'leaves the saved document and connection intact after failed %s and permits retry',
    async (stage) => {
      const before: LearningDocument = {
        schemaVersion: LEARNING_DOCUMENT_VERSION,
        cards: {},
        stats: {},
        settings: { theme: 'dark' },
        dataUpdatedAt: timestamp,
      };
      await replaceLearningDocument(before);
      const next = { ...before, settings: { theme: 'light' } };
      const writes = vi.spyOn(storage, 'setItem');
      if (stage === 'replacement') {
        writes.mockRejectedValueOnce(new Error('write failed'));
      }
      const input = stage === 'preparation' ? { ...next, cards: { invalid: {} } } : next;
      await expect(documentBackup.importData(JSON.stringify(input))).rejects.toThrow();
      expect(await readLearningDocument()).toEqual(before);
      expect(await readGistConnection()).toEqual(connection);
      expect(await storage.getItem(STORAGE_KEYS.lastSyncTime)).toBe('previous-sync');
      if (stage === 'preparation') {
        expect(writes).not.toHaveBeenCalled();
      }
      await documentBackup.importData(JSON.stringify(next));
      expect(JSON.parse(await documentBackup.exportData())).toEqual(next);
    }
  );

  it('rejects export before initialization without manufacturing a timestamp or document', async () => {
    await expect(documentBackup.exportData()).rejects.toThrow('Learning document is not initialized');
    expect(await readLearningDocument()).toBeUndefined();
  });
});
