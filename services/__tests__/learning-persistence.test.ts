import { Rating } from 'ts-fsrs';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fakeBrowser } from 'wxt/testing/fake-browser';
import { storage } from 'wxt/utils/storage';
import { getNoteStorageKey, STORAGE_KEYS } from '@/infrastructure/storage/storage-keys';
import { buildProblem } from '@/test/utils/card-mocks';
import { createDeferred } from '@/test/utils/deferred';
import { buildSettings } from '@/test/utils/settings-mocks';
import { addCard, getAllCards, rateCard, removeCard } from '../cards';
import { getNote, saveNote } from '../notes';
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

  it('awaits the card write before reading stats and awaits stats before requeue settings', async () => {
    const cardWrite = createDeferred<void>();
    const statsWrite = createDeferred<void>();
    const cardStarted = createDeferred<void>();
    const statsStarted = createDeferred<void>();
    const events: string[] = [];
    const getItem = storage.getItem.bind(storage);
    const setItem = storage.setItem.bind(storage);
    vi.spyOn(storage, 'getItem').mockImplementation((key, options) => {
      events.push(`read:${key}`);
      return getItem(key, options);
    });
    vi.spyOn(storage, 'setItem').mockImplementation(async (key, value) => {
      events.push(`write:${key}`);
      if (key === STORAGE_KEYS.cards) {
        cardStarted.resolve();
        await cardWrite.promise;
      } else if (key === STORAGE_KEYS.stats) {
        statsStarted.resolve();
        await statsWrite.promise;
      }
      await setItem(key, value);
    });
    vi.mocked(getSettings).mockImplementation(async () => {
      events.push('settings');
      return buildSettings();
    });

    const rating = rateCard({ ...buildProblem(), rating: Rating.Good });
    await cardStarted.promise;
    expect(events).toEqual([`read:${STORAGE_KEYS.cards}`, `write:${STORAGE_KEYS.cards}`]);
    cardWrite.resolve();
    await statsStarted.promise;
    expect(events).toEqual([
      `read:${STORAGE_KEYS.cards}`,
      `write:${STORAGE_KEYS.cards}`,
      `read:${STORAGE_KEYS.stats}`,
      'settings',
      'settings',
      `write:${STORAGE_KEYS.stats}`,
    ]);
    statsWrite.resolve();
    await rating;
    expect(events.at(-1)).toBe('settings');
    expect(getSettings).toHaveBeenCalledTimes(3);
    expect(await getItem(STORAGE_KEYS.dataUpdatedAt)).toBeNull();
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
      expect(getSettings).toHaveBeenCalledTimes(failedKey === STORAGE_KEYS.cards ? 0 : 2);
      expect(await storage.getItem(STORAGE_KEYS.dataUpdatedAt)).toBeNull();
    }
  );

  it('awaits note deletion before writing the card removal', async () => {
    const card = await addCard(buildProblem());
    await saveNote(card.id, 'solution');
    const started = createDeferred<void>();
    const deleted = createDeferred<void>();
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
