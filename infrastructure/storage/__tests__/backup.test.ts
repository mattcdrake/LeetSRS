import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fakeBrowser } from 'wxt/testing/fake-browser';
import { storage } from 'wxt/utils/storage';
import { mixedRecordBackup } from '@/test/utils/backup-mocks';
import { createDeferred } from '@/test/utils/deferred';
import {
  readSnapshotCards,
  readSnapshotNotes,
  removeSnapshotCards,
  removeSnapshotNotes,
  validateBackupRecords,
  writeSnapshotCards,
  writeSnapshotNotes,
} from '../backup';
import { getNoteStorageKey, STORAGE_KEYS } from '../storage-keys';

const rawCards = {
  first: { id: 'first', legacyField: true },
  second: { id: 'second', fsrs: { due: 'legacy-date' } },
};

async function seedCards() {
  await storage.setItem(STORAGE_KEYS.cards, rawCards);
  const cards = await readSnapshotCards();
  if (!cards) throw new Error('Missing fixture');
  return cards;
}

describe('snapshot storage', () => {
  beforeEach(() => {
    fakeBrowser.reset();
    fakeBrowser.runtime.id = 'test';
  });

  afterEach(() => {
    vi.restoreAllMocks();
    fakeBrowser.reset();
  });

  it('round-trips raw cards and whole notes without decoding or dropping unknown fields', async () => {
    const cards = await seedCards();
    const notes = {
      first: { text: 'note', legacyField: { preserved: true } },
      second: { text: 'another note' },
    };
    await writeSnapshotCards(cards);
    await writeSnapshotNotes(notes);
    expect(await storage.getItem(STORAGE_KEYS.cards)).toEqual(rawCards);
    expect(await readSnapshotNotes(cards)).toEqual(notes);
    expect(await storage.getItem(STORAGE_KEYS.dataUpdatedAt)).toBeNull();
  });

  it('waits for each note read and propagates failure without reading later notes', async () => {
    const cards = await seedCards();
    const pendingNote = createDeferred<null>();
    const failure = new Error('note read failed');
    const read = vi.spyOn(storage, 'getItem').mockImplementation(() => pendingNote.promise);
    const reading = readSnapshotNotes(cards);
    const rejected = expect(reading).rejects.toBe(failure);

    expect(read).toHaveBeenCalledExactlyOnceWith(getNoteStorageKey('first'));
    pendingNote.reject(failure);
    await rejected;
    expect(read).toHaveBeenCalledTimes(1);
  });

  it('uses the loaded card list for deletion, retaining orphan notes and repeated references', async () => {
    const cards = await seedCards();
    cards.duplicate = cards.first;
    await writeSnapshotNotes({ first: { text: 'first' }, second: { text: 'second' }, orphan: { text: 'orphan' } });
    await removeSnapshotCards();
    const remove = vi.spyOn(storage, 'removeItem');

    await removeSnapshotNotes(cards);

    expect(remove.mock.calls).toEqual([
      [getNoteStorageKey('first')],
      [getNoteStorageKey('second')],
      [getNoteStorageKey('first')],
    ]);
    expect(await storage.getItem(getNoteStorageKey('orphan'))).toEqual({ text: 'orphan' });
  });

  it('retains partial note writes and never starts later writes after a failure', async () => {
    const notes = JSON.parse(
      JSON.stringify({ data: { notes: { first: { text: 'first' }, second: null, third: { text: 'third' } } } })
    ).data.notes;
    const failure = new Error('note write failed');
    const write = storage.setItem.bind(storage);
    const writes = vi.spyOn(storage, 'setItem').mockImplementation(async (key, value) => {
      if (key === getNoteStorageKey('second')) throw failure;
      return write(key, value);
    });

    await expect(writeSnapshotNotes(notes)).rejects.toBe(failure);

    expect(writes.mock.calls).toEqual([
      [getNoteStorageKey('first'), { text: 'first' }],
      [getNoteStorageKey('second'), null],
    ]);
    expect(await storage.getItem(getNoteStorageKey('first'))).toEqual({ text: 'first' });
    expect(await storage.getItem(getNoteStorageKey('third'))).toBeNull();
    expect(await storage.getItem(STORAGE_KEYS.dataUpdatedAt)).toBeNull();
  });
});

describe('backup record validation', () => {
  it.each([
    { createdAt: 1e100 },
    { createdAt: null },
    { difficulty: ['Easy'] },
    { fsrs: { due: 1e100 } },
    { fsrs: { stability: -1 } },
    { fsrs: { difficulty: Number.POSITIVE_INFINITY } },
    { fsrs: { reps: 0.5 } },
    { fsrs: { state: 1.5 } },
  ])('rejects malformed card fields: %j', (overrides) => {
    const { accepted } = mixedRecordBackup();
    const card = accepted.cards['two-sum'];
    expect(() =>
      validateBackupRecords({
        cards: { invalid: { ...card, ...overrides, fsrs: { ...card.fsrs, ...overrides.fsrs } } },
        stats: {},
        notes: {},
      })
    ).toThrow();
  });

  it('removes extra nested fields without coercing supported values', () => {
    const { accepted } = mixedRecordBackup();
    const card = { ...accepted.cards['two-sum'], name: '  Two Sum  ' };
    const stats = accepted.stats['2024-01-01'];
    const records = {
      cards: { 'two-sum': { ...card, extra: true, fsrs: { ...card.fsrs, extra: { source: 'legacy' } } } },
      stats: { '2024-01-01': { ...stats, extra: true, gradeBreakdown: { ...stats.gradeBreakdown, extra: 42 } } },
      notes: { 'valid-com': { text: '  Keep this note  ', extra: true } },
      extra: true,
    };
    expect(validateBackupRecords(records)).toEqual({
      cards: { 'two-sum': card },
      stats: { '2024-01-01': stats },
      notes: { 'valid-com': { text: '  Keep this note  ' } },
    });
  });

  it('accepts an unreviewed card with zero FSRS values and no last review', () => {
    const { accepted } = mixedRecordBackup();
    const card = {
      ...accepted.cards['two-sum'],
      fsrs: {
        due: 0,
        state: 0,
        stability: 0,
        difficulty: 0,
        elapsed_days: 0,
        scheduled_days: 0,
        reps: 0,
        lapses: 0,
        learning_steps: 0,
      },
    };
    expect(validateBackupRecords({ cards: { 'two-sum': card }, stats: {}, notes: {} }).cards).toEqual({
      'two-sum': card,
    });
  });
});
