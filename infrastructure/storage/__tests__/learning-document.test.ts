import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fakeBrowser } from 'wxt/testing/fake-browser';
import type { LearningDocument } from '@/domain/learning-document';
import { mixedRecordBackup } from '@/test/utils/backup-mocks';
import { readLearningDocument, replaceLearningDocument } from '../learning-document';
import { STORAGE_KEYS } from '../storage-keys';

describe('learning document persistence', () => {
  beforeEach(() => fakeBrowser.reset());

  it('requires initialization and returns the current validated document once available', async () => {
    await expect(readLearningDocument()).rejects.toThrow('Learning document is not initialized');
    const document: LearningDocument = { schemaVersion: 6, cards: {}, stats: {}, settings: {} };
    await replaceLearningDocument(document);
    expect(await readLearningDocument()).toEqual(document);
  });

  it('replaces the complete document, clearing omitted notes, settings, and timestamps', async () => {
    const { embedded, payload } = mixedRecordBackup();
    const document: LearningDocument = {
      ...embedded,
      schemaVersion: 6,
      dataUpdatedAt: payload.dataUpdatedAt,
      settings: { language: 'de' },
    };
    await fakeBrowser.storage.sync.set({ 'leetsrs:gistConnection': { pat: 'secret', gistId: 'gist', enabled: true } });
    await fakeBrowser.storage.local.set({ 'leetsrs:lastSyncTime': '2024-01-01' });
    const connection = await fakeBrowser.storage.sync.get();
    await replaceLearningDocument(document);
    expect(await readLearningDocument()).toEqual(document);
    const empty: LearningDocument = { schemaVersion: 6, cards: {}, stats: {}, settings: {} };
    await replaceLearningDocument(empty);
    expect(await readLearningDocument()).toEqual(empty);
    expect(await fakeBrowser.storage.sync.get()).toEqual(connection);
    expect(await fakeBrowser.storage.local.get('leetsrs:lastSyncTime')).toEqual({
      'leetsrs:lastSyncTime': '2024-01-01',
    });
  });

  it('retains the previous document after invalid preparation or a rejected replacement', async () => {
    const { embedded } = mixedRecordBackup();
    const document: LearningDocument = { ...embedded, schemaVersion: 6, settings: {} };
    await replaceLearningDocument(document);
    const next = await readLearningDocument();
    next.cards['two-sum'].slug = 'mismatched';
    await expect(replaceLearningDocument(next)).rejects.toThrow('Card slug');
    expect(await readLearningDocument()).toEqual(document);

    next.cards['two-sum'].slug = 'two-sum';
    next.cards['two-sum'].paused = false;
    next.stats = {};
    next.settings = { theme: 'dark' };
    next.dataUpdatedAt = '2025-01-01';
    vi.spyOn(fakeBrowser.storage.local, 'set').mockRejectedValueOnce(new Error('Write failed'));
    await expect(replaceLearningDocument(next)).rejects.toThrow('Write failed');
    expect(await readLearningDocument()).toEqual(document);
    await replaceLearningDocument(next);
    expect(await readLearningDocument()).toEqual(next);
  });

  it('returns the normalized document that was persisted', async () => {
    const { embedded } = mixedRecordBackup();
    const { note: _note, ...cardWithoutNote } = embedded.cards['two-sum'];
    const document: LearningDocument = {
      ...embedded,
      schemaVersion: 6,
      cards: { 'two-sum': { ...cardWithoutNote, note: '' } },
      settings: {},
    };
    const expected = { ...document, cards: { 'two-sum': cardWithoutNote } };

    expect(await replaceLearningDocument(document)).toEqual(expected);
    expect(await readLearningDocument()).toEqual(expected);
    expect(document.cards['two-sum'].note).toBe('');
  });

  it('requires initialization for a stored null document', async () => {
    // fakeBrowser deletes null values; supply raw null at the storage boundary.
    vi.spyOn(fakeBrowser.storage.local, 'get').mockImplementationOnce(async () => ({
      [STORAGE_KEYS.learningDocument.slice('local:'.length)]: null,
    }));
    await expect(readLearningDocument()).rejects.toThrow('Learning document is not initialized');
  });

  it.each([{}, { schemaVersion: 5 }, { schemaVersion: 7 }])(
    'reports invalid saved data %j without falling back to legacy keys',
    async (invalid) => {
      await fakeBrowser.storage.local.set({
        [STORAGE_KEYS.learningDocument.slice('local:'.length)]: invalid,
        'leetsrs:cards': {},
        'leetsrs:stats': {},
      });
      await expect(readLearningDocument()).rejects.toThrow();
    }
  );
});
