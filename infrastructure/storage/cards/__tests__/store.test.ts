import { createEmptyCard, State } from 'ts-fsrs';
import { beforeEach, describe, expect, it } from 'vitest';
import { fakeBrowser } from 'wxt/testing/fake-browser';
import { storage } from 'wxt/utils/storage';
import type { ProblemDescriptor } from '@/domain/cards';
import { createMockCard } from '@/test/utils/card-mocks';
import { STORAGE_KEYS } from '../../storage-keys';
import { type StoredCard, serializeCard } from '../codec';
import { getAllCards, saveCards } from '../store';

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

  it('should properly deserialize stored cards', async () => {
    const testDate = new Date('2024-01-15T10:30:00Z');

    // Manually add a serialized card to storage
    const emptyFsrs = createEmptyCard();
    const storedCard: StoredCard = {
      id: 'test-id-deserialize',
      slug: 'test-problem',
      name: 'Test Problem',
      leetcodeId: '999',
      difficulty: 'Medium',
      createdAt: testDate.getTime(),
      fsrs: {
        ...emptyFsrs,
        due: emptyFsrs.due.getTime(),
        last_review: emptyFsrs.last_review?.getTime(),
      },
      paused: false,
      domain: 'leetcode.com',
    };

    await storage.setItem(STORAGE_KEYS.cards, { 'test-problem': storedCard });

    // Get all cards
    const allCards = await getAllCards();

    expect(allCards).toHaveLength(1);
    expect(allCards[0].slug).toBe('test-problem');
    expect(allCards[0].name).toBe('Test Problem');
    expect(allCards[0].createdAt).toBeInstanceOf(Date);
    expect(allCards[0].createdAt.getTime()).toBe(testDate.getTime());
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
      reviewed: serializeCard(reviewed),
      added: serializeCard(added),
    });

    await saveCards([]);
    expect(await getAllCards()).toEqual([]);
  });
});
