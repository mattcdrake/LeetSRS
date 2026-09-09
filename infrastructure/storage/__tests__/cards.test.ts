import { State } from 'ts-fsrs';
import { beforeEach, describe, expect, it } from 'vitest';
import { fakeBrowser } from 'wxt/testing/fake-browser';
import { storage } from 'wxt/utils/storage';
import { ZodError } from 'zod';
import type { ProblemDescriptor } from '@/domain/cards';
import { createMockCard } from '@/test/utils/card-mocks';
import { getAllCards, saveCards } from '../cards';
import { STORAGE_KEYS } from '../storage-keys';

async function addFixture(problem: ProblemDescriptor): Promise<void> {
  await saveCards([...(await getAllCards()), createMockCard(State.New, problem)]);
}

describe('getAllCards', () => {
  beforeEach(() => {
    // Reset the fake browser state before each test
    fakeBrowser.reset();
  });

  it('should return empty array when no cards exist', async () => {
    const cards = await getAllCards();
    expect(cards).toEqual([]);
  });

  it('should return all cards from storage', async () => {
    // Add multiple cards
    await addFixture({ slug: 'two-sum', name: 'Two Sum', leetcodeId: '1', difficulty: 'Easy', domain: 'leetcode.com' });
    await addFixture({
      slug: 'valid-parentheses',
      name: 'Valid Parentheses',
      leetcodeId: '20',
      difficulty: 'Medium',
      domain: 'leetcode.com',
    });
    await addFixture({
      slug: 'merge-intervals',
      name: 'Merge Intervals',
      leetcodeId: '56',
      difficulty: 'Hard',
      domain: 'leetcode.com',
    });

    // Get all cards
    const allCards = await getAllCards();

    expect(allCards).toHaveLength(3);

    // Check that all cards are present
    const cardSlugs = allCards.map((c) => c.slug);
    expect(cardSlugs).toContain('two-sum');
    expect(cardSlugs).toContain('valid-parentheses');
    expect(cardSlugs).toContain('merge-intervals');

    // Check that cards have correct data
    const foundCard1 = allCards.find((c) => c.slug === 'two-sum');
    expect(foundCard1?.name).toBe('Two Sum');

    const foundCard2 = allCards.find((c) => c.slug === 'valid-parentheses');
    expect(foundCard2?.name).toBe('Valid Parentheses');

    const foundCard3 = allCards.find((c) => c.slug === 'merge-intervals');
    expect(foundCard3?.name).toBe('Merge Intervals');
  });

  it.each([undefined, 0, 1705222800000])('preserves numeric dates and last_review %s', async (lastReview) => {
    const card = createMockCard(State.Review, { createdAt: 0 });
    card.fsrs.due = 0;
    card.fsrs.last_review = lastReview;
    await saveCards([card]);

    expect(await storage.getItem(STORAGE_KEYS.cards)).toEqual({ [card.slug]: card });
    expect(await getAllCards()).toEqual([card]);
  });

  it.each([[], false, 'cards', { invalid: null }, { invalid: {} }])(
    'rejects malformed stored cards %j',
    async (value) => {
      await storage.setItem(STORAGE_KEYS.cards, value);
      await expect(getAllCards()).rejects.toBeInstanceOf(ZodError);
    }
  );

  it.each([
    { slug: '' },
    { domain: 'example.com' },
    { paused: 'false' },
    { createdAt: '2024-01-01' },
    { fsrs: { due: null } },
    { fsrs: { reps: -1 } },
    { fsrs: { state: 99 } },
    { fsrs: { last_review: '2024-01-01' } },
  ])('rejects malformed card fields without changing storage: %j', async (overrides) => {
    const card = createMockCard(State.Review);
    const records = {
      valid: card,
      invalid: { ...card, ...overrides, fsrs: { ...card.fsrs, ...overrides.fsrs } },
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
