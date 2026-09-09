import { State } from 'ts-fsrs';
import { beforeEach, describe, expect, it } from 'vitest';
import { fakeBrowser } from 'wxt/testing/fake-browser';
import { storage } from 'wxt/utils/storage';
import { ZodError } from 'zod';
import { createMockCard } from '@/test/utils/card-mocks';
import { getAllCards, saveCards } from '../cards';
import { STORAGE_KEYS } from '../storage-keys';

describe('getAllCards', () => {
  beforeEach(() => {
    // Reset the fake browser state before each test
    fakeBrowser.reset();
  });

  it('should return empty array when no cards exist', async () => {
    const cards = await getAllCards();
    expect(cards).toEqual([]);
  });

  it.each([undefined, 0, 1705222800000])('preserves numeric dates and last_review %s', async (lastReview) => {
    const card = createMockCard(State.Review, { createdAt: 0 });
    card.fsrs.due = 0;
    card.fsrs.last_review = lastReview;
    await saveCards([card]);

    expect(await storage.getItem(STORAGE_KEYS.cards)).toEqual({ [card.slug]: card });
    expect(await getAllCards()).toEqual([card]);
  });

  it.each(['container', 'nested field'])('rejects a malformed %s without changing storage', async (kind) => {
    const card = createMockCard(State.Review);
    const records =
      kind === 'container'
        ? []
        : {
            valid: card,
            invalid: { ...card, fsrs: { ...card.fsrs, due: '2024-01-01' } },
          };
    await storage.setItem(STORAGE_KEYS.cards, records);
    await expect(getAllCards()).rejects.toBeInstanceOf(ZodError);
    expect(await storage.getItem(STORAGE_KEYS.cards)).toEqual(records);
  });

  it('strips unknown card and FSRS fields on reads without rewriting storage', async () => {
    const card = createMockCard(State.Review, { name: '  Two Sum  ' });
    const records = { [card.slug]: { ...card, extra: true, fsrs: { ...card.fsrs, extra: true } } };
    await storage.setItem(STORAGE_KEYS.cards, records);
    expect(await getAllCards()).toEqual([card]);
    expect(await storage.getItem(STORAGE_KEYS.cards)).toEqual(records);
  });
});

describe('saveCards', () => {
  beforeEach(() => fakeBrowser.reset());

  it('replaces stored cards with the supplied supported cards', async () => {
    const removed = createMockCard(State.New, { slug: 'removed' });
    const reviewed = createMockCard(State.Review, { slug: 'reviewed', domain: 'leetcode.cn', paused: true });
    const added = createMockCard(State.New, { slug: 'added' });
    await saveCards([removed, reviewed]);
    await saveCards([reviewed, added]);

    expect(await getAllCards()).toEqual([reviewed, added]);
    expect(await storage.getItem(STORAGE_KEYS.cards)).toEqual({
      reviewed,
      added,
    });

    await saveCards([]);
    expect(await getAllCards()).toEqual([]);
  });
});
