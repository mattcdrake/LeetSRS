import { Rating } from 'ts-fsrs';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fakeBrowser } from 'wxt/testing/fake-browser';
import { storage } from 'wxt/utils/storage';
import { getNote, saveNote } from '@/infrastructure/storage/notes';
import { getNoteStorageKey, STORAGE_KEYS } from '@/infrastructure/storage/storage-keys';
import { buildProblem } from '@/test/utils/card-mocks';
import { buildSettings } from '@/test/utils/settings-mocks';
import { addCard, getAllCards, rateCard, removeCard } from '../cards';
import { getSettings } from '../settings';

vi.mock('../settings', () => ({ getSettings: vi.fn() }));

describe('learning persistence sequencing', () => {
  beforeEach(() => {
    fakeBrowser.reset();
    // Browser storage returns copies; the fake can otherwise retain mutations
    // to a read object even when its subsequent write is rejected.
    const get = fakeBrowser.storage.local.get.bind(fakeBrowser.storage.local);
    vi.spyOn(fakeBrowser.storage.local, 'get').mockImplementation(async (keys) => structuredClone(await get(keys)));
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2024-03-15T12:00:00'));
    vi.mocked(getSettings).mockResolvedValue(buildSettings());
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('awaits card and statistics persistence before resolving a rating', async () => {
    const cardWrite = Promise.withResolvers<void>();
    const statsWrite = Promise.withResolvers<void>();
    const cardStarted = Promise.withResolvers<void>();
    const statsStarted = Promise.withResolvers<void>();
    const setItem = storage.setItem.bind(storage);
    vi.spyOn(storage, 'setItem').mockImplementation(async (key, value) => {
      if (key === STORAGE_KEYS.cards) {
        cardStarted.resolve();
        await cardWrite.promise;
      } else if (key === STORAGE_KEYS.stats) {
        statsStarted.resolve();
        await statsWrite.promise;
      }
      await setItem(key, value);
    });
    const settled = vi.fn();
    const rating = rateCard({ ...buildProblem(), rating: Rating.Good }).then(settled);

    await cardStarted.promise;
    expect(settled).not.toHaveBeenCalled();
    expect(await storage.getItem(STORAGE_KEYS.stats)).toBeNull();
    cardWrite.resolve();
    await statsStarted.promise;
    expect(settled).not.toHaveBeenCalled();
    expect(await getAllCards()).toHaveLength(1);
    statsWrite.resolve();
    await rating;

    expect(await storage.getItem(STORAGE_KEYS.stats)).toMatchObject({
      '2024-03-15': { totalReviews: 1, newCards: 1 },
    });
    expect(await storage.getItem(STORAGE_KEYS.dataUpdatedAt)).toBeNull();
  });

  it.each([STORAGE_KEYS.cards, STORAGE_KEYS.stats])(
    'preserves partial rating state when %s fails',
    async (failedKey) => {
      const failure = new Error('write failed');
      const setItem = storage.setItem.bind(storage);
      const writes = vi.spyOn(storage, 'setItem').mockImplementation(async (key, value) => {
        if (key === failedKey) throw failure;
        await setItem(key, value);
      });

      await expect(rateCard({ ...buildProblem(), rating: Rating.Good })).rejects.toBe(failure);

      expect(writes.mock.calls.map(([key]) => key)).toEqual(
        failedKey === STORAGE_KEYS.cards ? [STORAGE_KEYS.cards] : [STORAGE_KEYS.cards, STORAGE_KEYS.stats]
      );
      const cards = await getAllCards();
      expect(cards).toHaveLength(failedKey === STORAGE_KEYS.cards ? 0 : 1);
      if (failedKey === STORAGE_KEYS.stats) expect(cards[0].fsrs.reps).toBe(1);
      expect(await storage.getItem(STORAGE_KEYS.stats)).toBeNull();
      expect(await storage.getItem(STORAGE_KEYS.dataUpdatedAt)).toBeNull();
    }
  );

  it('awaits note deletion before writing the card removal', async () => {
    const card = await addCard(buildProblem());
    await saveNote(card.id, 'solution');
    const started = Promise.withResolvers<void>();
    const deleted = Promise.withResolvers<void>();
    const removeItem = storage.removeItem.bind(storage);
    const removal = vi.spyOn(storage, 'removeItem').mockImplementation(async (key) => {
      started.resolve();
      await deleted.promise;
      await removeItem(key);
    });
    const writes = vi.spyOn(storage, 'setItem');

    const removing = removeCard(card.slug);
    await started.promise;
    expect(removal).toHaveBeenCalledWith(getNoteStorageKey(card.id));
    expect(writes).not.toHaveBeenCalled();
    expect(await getAllCards()).toEqual([card]);
    deleted.resolve();
    await removing;
    expect(writes).toHaveBeenCalledExactlyOnceWith(STORAGE_KEYS.cards, {});
    expect(await getNote(card.id)).toBeNull();
  });

  it.each(['note', 'card'])('preserves partial removal state when the %s operation fails', async (failedOperation) => {
    const card = await addCard(buildProblem());
    await saveNote(card.id, 'solution');
    const failure = new Error('removal failed');
    if (failedOperation === 'note') vi.spyOn(storage, 'removeItem').mockRejectedValueOnce(failure);
    const writes = vi.spyOn(storage, 'setItem');
    if (failedOperation === 'card') writes.mockRejectedValueOnce(failure);

    await expect(removeCard(card.slug)).rejects.toBe(failure);

    expect(await getAllCards()).toEqual([card]);
    expect(await getNote(card.id)).toEqual(failedOperation === 'note' ? { text: 'solution' } : null);
    expect(writes).toHaveBeenCalledTimes(failedOperation === 'note' ? 0 : 1);
    expect(await storage.getItem(STORAGE_KEYS.dataUpdatedAt)).toBeNull();
  });
});
