import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { fakeBrowser } from 'wxt/testing';
import { storage } from 'wxt/utils/storage';
import {
  addCard,
  getAllCards,
  removeCard,
  serializeCard,
  deserializeCard,
  rateCard,
  getReviewQueue,
  MAX_NEW_CARDS_PER_DAY,
  type StoredCard,
} from '../cards';
import { type Card } from '@/types';
import { STORAGE_KEYS } from '../storage-keys';
import { createEmptyCard, Rating, State as FsrsState } from 'ts-fsrs';
import type { DailyStats } from '../stats';

describe('Card serialization', () => {
  describe('serializeCard', () => {
    it('should convert Date to timestamp', () => {
      const testDate = new Date('2024-01-15T10:30:00Z');
      const card: Card = {
        id: 'test-id-1',
        slug: 'two-sum',
        name: 'Two Sum',
        leetcodeId: '1',
        difficulty: 'Easy',
        createdAt: testDate,
        fsrs: createEmptyCard(),
      };

      const serialized = serializeCard(card);

      expect(serialized.slug).toBe('two-sum');
      expect(serialized.name).toBe('Two Sum');
      expect(serialized.createdAt).toBe(testDate.getTime());
      expect(typeof serialized.createdAt).toBe('number');
    });

    it('should serialize FSRS card dates', () => {
      const testDate = new Date('2024-01-15T10:30:00Z');
      const fsrsCard = createEmptyCard();
      fsrsCard.last_review = new Date('2024-01-14T09:00:00Z');

      const card: Card = {
        id: 'test-id-2',
        slug: 'two-sum',
        name: 'Two Sum',
        leetcodeId: '1',
        difficulty: 'Medium',
        createdAt: testDate,
        fsrs: fsrsCard,
      };

      const serialized = serializeCard(card);

      expect(typeof serialized.fsrs.due).toBe('number');
      expect(serialized.fsrs.due).toBe(fsrsCard.due.getTime());
      expect(typeof serialized.fsrs.last_review).toBe('number');
      expect(serialized.fsrs.last_review).toBe(fsrsCard.last_review.getTime());
      expect(serialized.fsrs.stability).toBe(fsrsCard.stability);
      expect(serialized.fsrs.difficulty).toBe(fsrsCard.difficulty);
    });
  });

  describe('deserializeCard', () => {
    it('should convert timestamp back to Date object', () => {
      const timestamp = new Date('2024-01-15T10:30:00Z').getTime();
      const emptyFsrs = createEmptyCard();
      const storedCard: StoredCard = {
        id: 'test-id-3',
        slug: 'merge-intervals',
        name: 'Merge Intervals',
        leetcodeId: '56',
        difficulty: 'Hard',
        createdAt: timestamp,
        fsrs: {
          ...emptyFsrs,
          due: emptyFsrs.due.getTime(),
          last_review: emptyFsrs.last_review?.getTime(),
        },
      };

      const deserialized = deserializeCard(storedCard);

      expect(deserialized.slug).toBe('merge-intervals');
      expect(deserialized.name).toBe('Merge Intervals');
      expect(deserialized.createdAt).toBeInstanceOf(Date);
      expect(deserialized.createdAt.getTime()).toBe(timestamp);
    });
  });

  describe('serializeCard and deserializeCard roundtrip', () => {
    it('should maintain data integrity through serialization and deserialization', () => {
      const originalCard: Card = {
        id: 'test-id-4',
        slug: 'two-pointers',
        name: 'Two Pointers',
        leetcodeId: '999',
        difficulty: 'Medium',
        createdAt: new Date(),
        fsrs: createEmptyCard(),
      };

      const serialized = serializeCard(originalCard);
      const deserialized = deserializeCard(serialized);

      expect(deserialized.slug).toBe(originalCard.slug);
      expect(deserialized.name).toBe(originalCard.name);
      expect(deserialized.createdAt.getTime()).toBe(originalCard.createdAt.getTime());
    });
  });
});

describe('addCard', () => {
  beforeEach(() => {
    // Reset the fake browser state before each test
    fakeBrowser.reset();
  });

  it('should create and store a new card', async () => {
    const card = await addCard('two-sum', 'Two Sum', '1', 'Easy');

    expect(card.id).toBeDefined();
    expect(card.id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i);
    expect(card.slug).toBe('two-sum');
    expect(card.name).toBe('Two Sum');
    expect(card.difficulty).toBe('Easy');
    expect(card.createdAt).toBeInstanceOf(Date);

    // Verify FSRS card is created
    expect(card.fsrs).toBeDefined();
    expect(card.fsrs.due).toBeInstanceOf(Date);
    expect(card.fsrs.stability).toBeDefined();
    expect(card.fsrs.difficulty).toBeDefined();
    expect(card.fsrs.reps).toBe(0);
    expect(card.fsrs.lapses).toBe(0);

    // Verify the card was actually stored using WXT storage
    const cards = await storage.getItem<Record<string, StoredCard>>(STORAGE_KEYS.cards);

    expect(cards).toBeDefined();
    expect(cards!['two-sum']).toBeDefined();
    expect(cards!['two-sum'].slug).toBe('two-sum');
    expect(cards!['two-sum'].name).toBe('Two Sum');

    // Verify FSRS data is stored properly
    expect(cards!['two-sum'].fsrs).toBeDefined();
    expect(typeof cards!['two-sum'].fsrs.due).toBe('number');
  });

  it('should return existing card when adding same slug (idempotent)', async () => {
    // Add card first time
    const firstCard = await addCard('valid-parentheses', 'Valid Parentheses', '20', 'Medium');
    const firstCreatedAt = firstCard.createdAt;
    const firstId = firstCard.id;

    // Add same card again
    const secondCard = await addCard('valid-parentheses', 'A different name', '20', 'Hard');

    // Should return the same card
    expect(secondCard.id).toBe(firstId);
    expect(secondCard.slug).toBe('valid-parentheses');
    expect(secondCard.createdAt.getTime()).toBe(firstCreatedAt.getTime());
    expect(secondCard.name).toBe('Valid Parentheses');
    expect(secondCard.difficulty).toBe('Medium');

    // Verify only one card exists in storage
    const cards = await storage.getItem<Record<string, StoredCard>>(STORAGE_KEYS.cards);

    expect(Object.keys(cards || {}).length).toBe(1);
  });

  it('should store multiple different cards correctly', async () => {
    // Add multiple cards
    await addCard('two-sum', 'Two Sum', '1', 'Easy');
    await addCard('valid-parentheses', 'Valid Parentheses', '20', 'Medium');
    await addCard('merge-two-sorted-lists', 'Merge Two Sorted Lists', '21', 'Hard');

    // Verify all cards are stored
    const cards = await storage.getItem<Record<string, StoredCard>>(STORAGE_KEYS.cards);

    expect(Object.keys(cards || {}).length).toBe(3);

    // Verify cards exist
    expect(cards!['two-sum']).toBeDefined();
    expect(cards!['valid-parentheses']).toBeDefined();
    expect(cards!['merge-two-sorted-lists']).toBeDefined();
  });

  it('should set createdAt to current date', async () => {
    const beforeTime = new Date();
    const card = await addCard('test-problem', 'Test Problem', '999', 'Medium');
    const afterTime = new Date();

    expect(card.createdAt).toBeInstanceOf(Date);
    expect(card.createdAt.getTime()).toBeGreaterThanOrEqual(beforeTime.getTime());
    expect(card.createdAt.getTime()).toBeLessThanOrEqual(afterTime.getTime());
  });

  it('should properly serialize card when storing', async () => {
    const card = await addCard('serialize-test', 'Serialize Test', '1000', 'Easy');

    const cards = await storage.getItem<Record<string, StoredCard>>(STORAGE_KEYS.cards);
    const storedCard = cards![card.slug];

    expect(typeof storedCard.createdAt).toBe('number');
    expect(storedCard.slug).toBe(card.slug);
    expect(storedCard.name).toBe(card.name);
  });
});

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
    await addCard('two-sum', 'Two Sum', '1', 'Easy');
    await addCard('valid-parentheses', 'Valid Parentheses', '20', 'Medium');
    await addCard('merge-intervals', 'Merge Intervals', '56', 'Hard');

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

describe('removeCard', () => {
  beforeEach(() => {
    // Reset the fake browser state before each test
    fakeBrowser.reset();
  });

  it('should remove an existing card and its slug mapping', async () => {
    // Add a card first
    await addCard('two-sum', 'Two Sum', '1', 'Easy');

    // Verify it exists
    let cards = await storage.getItem<Record<string, StoredCard>>(STORAGE_KEYS.cards);
    expect(cards!['two-sum']).toBeDefined();

    // Remove the card
    await removeCard('two-sum');

    // Verify it's removed
    cards = await storage.getItem<Record<string, StoredCard>>(STORAGE_KEYS.cards);
    expect(cards!['two-sum']).toBeUndefined();
  });

  it('should handle removing non-existent card gracefully', async () => {
    // Try to remove a card that doesn't exist
    await expect(removeCard('non-existent-slug')).resolves.toBeUndefined();

    // Verify storage is still empty/unchanged
    const cards = await storage.getItem<Record<string, StoredCard>>(STORAGE_KEYS.cards);
    expect(cards || {}).toEqual({});
  });

  it('should only remove the specified card when multiple cards exist', async () => {
    // Add multiple cards
    await addCard('two-sum', 'Two Sum', '1', 'Easy');
    await addCard('valid-parentheses', 'Valid Parentheses', '20', 'Medium');
    await addCard('merge-intervals', 'Merge Intervals', '56', 'Hard');

    // Remove the middle card
    await removeCard('valid-parentheses');

    // Verify only the specified card is removed
    const cards = await storage.getItem<Record<string, StoredCard>>(STORAGE_KEYS.cards);

    expect(Object.keys(cards || {}).length).toBe(2);

    // Card 1 should still exist
    expect(cards!['two-sum']).toBeDefined();

    // Card 2 should be removed
    expect(cards!['valid-parentheses']).toBeUndefined();

    // Card 3 should still exist
    expect(cards!['merge-intervals']).toBeDefined();
  });

  it('should verify card is actually removed from getAllCards', async () => {
    // Add multiple cards
    await addCard('two-sum', 'Two Sum', '1', 'Easy');
    await addCard('valid-parentheses', 'Valid Parentheses', '20', 'Medium');
    await addCard('merge-intervals', 'Merge Intervals', '56', 'Hard');

    // Get initial count
    let allCards = await getAllCards();
    expect(allCards).toHaveLength(3);

    // Remove one card
    await removeCard('valid-parentheses');

    // Verify it's not in getAllCards
    allCards = await getAllCards();
    expect(allCards).toHaveLength(2);
    expect(allCards.some((c) => c.slug === 'valid-parentheses')).toBe(false);
    expect(allCards.some((c) => c.slug === 'two-sum')).toBe(true);
    expect(allCards.some((c) => c.slug === 'merge-intervals')).toBe(true);
  });
});

describe('rateCard', () => {
  beforeEach(() => {
    // Reset the fake browser state before each test
    fakeBrowser.reset();
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2024-03-15T10:00:00'));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('should create a new card if it does not exist', async () => {
    const card = await rateCard('new-problem', 'New Problem', Rating.Good, '9999', 'Medium');

    expect(card.slug).toBe('new-problem');
    expect(card.name).toBe('New Problem');
    expect(card.createdAt).toBeInstanceOf(Date);
    expect(card.fsrs).toBeDefined();

    // Verify the card was stored
    const cards = await storage.getItem<Record<string, StoredCard>>(STORAGE_KEYS.cards);
    expect(cards!['new-problem']).toBeDefined();
  });

  it('should update existing card when rating', async () => {
    // First create a card
    const initialCard = await addCard('two-sum', 'Two Sum', '1', 'Easy');
    const initialReps = initialCard.fsrs.reps;
    const initialStability = initialCard.fsrs.stability;

    // Rate the card as Good
    const ratedCard = await rateCard('two-sum', 'Two Sum', Rating.Good, '1', 'Easy');

    expect(ratedCard.slug).toBe('two-sum');
    expect(ratedCard.name).toBe('Two Sum');

    // FSRS should update the card
    expect(ratedCard.fsrs.reps).toBeGreaterThan(initialReps);
    expect(ratedCard.fsrs.stability).not.toBe(initialStability);
    expect(ratedCard.fsrs.last_review).toBeInstanceOf(Date);
  });

  it('should handle different grades correctly', async () => {
    // Create a card
    await addCard('test-problem', 'Test Problem', '999', 'Medium');

    // Rate as Again (fail)
    const failedCard = await rateCard('test-problem', 'Test Problem', Rating.Again, '999', 'Medium');
    expect(failedCard.fsrs.reps).toBe(1);
    expect(failedCard.fsrs.lapses).toBe(0);

    // Rate as Easy
    const easyCard = await rateCard('test-problem', 'Test Problem', Rating.Easy, '999', 'Medium');
    expect(easyCard.fsrs.reps).toBeGreaterThan(0);
  });

  it('should update the due date after rating', async () => {
    const card = await addCard('merge-sort', 'Merge Sort', '88', 'Hard');
    const initialDue = card.fsrs.due;

    const ratedCard = await rateCard('merge-sort', 'Merge Sort', Rating.Good, '88', 'Hard');

    expect(ratedCard.fsrs.due).toBeInstanceOf(Date);
    expect(ratedCard.fsrs.due.getTime()).toBeGreaterThan(initialDue.getTime());
  });

  it('should persist card updates to storage', async () => {
    await addCard('binary-search', 'Binary Search', '704', 'Medium');

    // Rate the card
    await rateCard('binary-search', 'Binary Search', Rating.Hard, '704', 'Medium');

    // Verify the updated card is in storage
    const cards = await storage.getItem<Record<string, StoredCard>>(STORAGE_KEYS.cards);
    const storedCard = cards!['binary-search'];

    expect(storedCard).toBeDefined();
    expect(typeof storedCard.fsrs.last_review).toBe('number');
  });

  it('should handle multiple ratings on the same card', async () => {
    const slug = 'dynamic-programming';

    // First rating (creates card)
    const card1 = await rateCard(slug, 'Multi Rate', Rating.Again, '9998', 'Hard');
    expect(card1.fsrs.reps).toBe(1);
    expect(card1.fsrs.lapses).toBe(0);

    // Second rating
    const card2 = await rateCard(slug, 'Multi Rate', Rating.Hard, '9998', 'Hard');
    expect(card2.fsrs.reps).toBeGreaterThan(0);

    // Third rating
    const card3 = await rateCard(slug, 'Multi Rate', Rating.Good, '9998', 'Hard');
    expect(card3.fsrs.reps).toBeGreaterThan(card2.fsrs.reps);

    // Verify only one card exists in storage
    const allCards = await getAllCards();
    const dpCards = allCards.filter((c) => c.slug === slug);
    expect(dpCards).toHaveLength(1);
  });

  it('should update stats when rating a new card', async () => {
    // Rate a new card (doesn't exist yet)
    await rateCard('new-problem', 'New Problem', Rating.Good, '9999', 'Medium');

    // Check that stats were created
    const stats = await storage.getItem<Record<string, DailyStats>>(STORAGE_KEYS.stats);
    const todayStats = stats?.['2024-03-15'];

    expect(todayStats).toBeDefined();
    expect(todayStats?.totalReviews).toBe(1);
    expect(todayStats?.newCards).toBe(1);
    expect(todayStats?.reviewedCards).toBe(0);
    expect(todayStats?.gradeBreakdown[Rating.Good]).toBe(1);
  });

  it('should update stats correctly for review cards vs new cards', async () => {
    // Create a card
    await addCard('test-card', 'Test Card', '1000', 'Easy');

    // First rating (card is new)
    await rateCard('test-card', 'Test Card', Rating.Good, '1000', 'Easy');

    let stats = await storage.getItem<Record<string, DailyStats>>(STORAGE_KEYS.stats);
    let todayStats = stats?.['2024-03-15'];

    expect(todayStats?.totalReviews).toBe(1);
    expect(todayStats?.newCards).toBe(1);
    expect(todayStats?.reviewedCards).toBe(0);

    // Second rating (card is now a review card)
    await rateCard('test-card', 'Test Card', Rating.Hard, '1000', 'Easy');

    stats = await storage.getItem<Record<string, DailyStats>>(STORAGE_KEYS.stats);
    todayStats = stats?.['2024-03-15'];

    expect(todayStats?.totalReviews).toBe(2);
    expect(todayStats?.newCards).toBe(1); // Still 1, not incremented
    expect(todayStats?.reviewedCards).toBe(1); // Now 1
    expect(todayStats?.gradeBreakdown[Rating.Good]).toBe(1);
    expect(todayStats?.gradeBreakdown[Rating.Hard]).toBe(1);
  });
});

describe('getReviewQueue', () => {
  // Helper function to create test stats with sensible defaults
  const createTestStats = (overrides: Partial<DailyStats> = {}): Record<string, DailyStats> => {
    const todayKey = '2024-01-15';
    const defaults: DailyStats = {
      date: todayKey,
      totalReviews: 0,
      gradeBreakdown: {
        [Rating.Again]: 0,
        [Rating.Hard]: 0,
        [Rating.Good]: 0,
        [Rating.Easy]: 0,
      },
      newCards: 0,
      reviewedCards: 0,
      streak: 1,
    };

    // Auto-calculate totalReviews if not provided
    const stats = { ...defaults, ...overrides };
    if (!overrides.totalReviews) {
      stats.totalReviews = stats.newCards + stats.reviewedCards;
    }

    return { [todayKey]: stats };
  };

  beforeEach(() => {
    fakeBrowser.reset();
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2024-01-15T12:00:00Z'));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('should return empty array when no cards exist', async () => {
    const queue = await getReviewQueue();
    expect(queue).toEqual([]);
  });

  it('should return only new cards when no reviews are due', async () => {
    // Create cards - all new
    await addCard('problem1', 'Problem 1', '1001', 'Easy');
    await addCard('problem2', 'Problem 2', '1002', 'Medium');
    await addCard('problem3', 'Problem 3', '1003', 'Hard');
    await addCard('problem4', 'Problem 4', '1004', 'Easy');
    await addCard('problem5', 'Problem 5', '1005', 'Medium');

    const queue = await getReviewQueue();

    // Should only get MAX_NEW_CARDS_PER_DAY
    expect(queue).toHaveLength(MAX_NEW_CARDS_PER_DAY);
    expect(queue.every((card) => card.fsrs.state === FsrsState.New)).toBe(true);
  });

  it('should return only review cards when they are due', async () => {
    // Create and rate cards to make them review cards
    await addCard('problem1', 'Problem 1', '1001', 'Easy');
    await addCard('problem2', 'Problem 2', '1002', 'Medium');

    // Rate them to move out of New state
    await rateCard('problem1', 'Problem 1', Rating.Good, '1001', 'Easy');
    await rateCard('problem2', 'Problem 2', Rating.Good, '1002', 'Medium');

    // Manually update their due dates to be in the past
    const cards = await storage.getItem<Record<string, StoredCard>>(STORAGE_KEYS.cards);
    const pastTime = new Date('2024-01-14T12:00:00Z').getTime();
    cards!['problem1'].fsrs.due = pastTime;
    cards!['problem2'].fsrs.due = pastTime;
    await storage.setItem(STORAGE_KEYS.cards, cards);

    const queue = await getReviewQueue();

    expect(queue).toHaveLength(2);
    expect(queue.every((card) => card.fsrs.state !== FsrsState.New)).toBe(true);
  });

  it('should interleave review and new cards', async () => {
    // Reset stats to ensure clean state
    await storage.setItem(STORAGE_KEYS.stats, {});

    // Create some new cards
    await addCard('new1', 'New 1', '2001', 'Easy');
    await addCard('new2', 'New 2', '2002', 'Medium');
    await addCard('new3', 'New 3', '2003', 'Hard');
    await addCard('new4', 'New 4', '2004', 'Easy'); // This won't be included (exceeds limit)

    // Create some review cards
    await addCard('review1', 'Review 1', '3001', 'Medium');
    await addCard('review2', 'Review 2', '3002', 'Hard');

    // Rate review cards to move them out of New state
    await rateCard('review1', 'Review 1', Rating.Good, '3001', 'Medium');
    await rateCard('review2', 'Review 2', Rating.Good, '3002', 'Hard');

    // Set their due dates to the past
    const cards = await storage.getItem<Record<string, StoredCard>>(STORAGE_KEYS.cards);
    const pastTime = new Date('2024-01-14T12:00:00Z').getTime();
    cards!['review1'].fsrs.due = pastTime;
    cards!['review2'].fsrs.due = pastTime;
    await storage.setItem(STORAGE_KEYS.cards, cards);

    const queue = await getReviewQueue();

    // Rating the cards created stats entries, so we need to account for that
    // We rated 2 cards as new (review1 and review2 were new when first rated)
    // So remaining new cards = MAX_NEW_CARDS_PER_DAY - 2 = 1
    // Total = 2 review cards + 1 new card = 3
    expect(queue).toHaveLength(3);

    const newCards = queue.filter((card) => card.fsrs.state === FsrsState.New);
    const reviewCards = queue.filter((card) => card.fsrs.state !== FsrsState.New);

    expect(newCards).toHaveLength(1); // Only 1 new card left after rating 2
    expect(reviewCards).toHaveLength(2);
  });

  it('should not include future due cards', async () => {
    await addCard('future1', 'Future 1', '4001', 'Easy');
    await rateCard('future1', 'Future 1', Rating.Good, '4001', 'Easy');

    // Set due date to future
    const cards = await storage.getItem<Record<string, StoredCard>>(STORAGE_KEYS.cards);
    const futureTime = new Date('2024-01-16T12:00:00Z').getTime();
    cards!['future1'].fsrs.due = futureTime;
    await storage.setItem(STORAGE_KEYS.cards, cards);

    const queue = await getReviewQueue();

    expect(queue).toHaveLength(0);
  });

  it('should handle mix of new, due, and future cards', async () => {
    // Reset stats to ensure clean state
    await storage.setItem(STORAGE_KEYS.stats, {});

    // Create new cards
    await addCard('new1', 'New 1', '2001', 'Easy');
    await addCard('new2', 'New 2', '2002', 'Medium');

    // Create due review cards
    await addCard('due1', 'Due 1', '5001', 'Medium');
    await rateCard('due1', 'Due 1', Rating.Good, '5001', 'Medium');

    // Create future review cards
    await addCard('future1', 'Future 1', '4001', 'Easy');
    await rateCard('future1', 'Future 1', Rating.Easy, '4001', 'Easy');

    // Manually set due dates
    const cards = await storage.getItem<Record<string, StoredCard>>(STORAGE_KEYS.cards);
    const pastTime = new Date('2024-01-14T12:00:00Z').getTime();
    const futureTime = new Date('2024-01-16T12:00:00Z').getTime();
    cards!['due1'].fsrs.due = pastTime;
    cards!['future1'].fsrs.due = futureTime;
    await storage.setItem(STORAGE_KEYS.cards, cards);

    const queue = await getReviewQueue();

    // We rated 2 cards (due1 and future1), using up 2 of our 3 daily new cards
    // So only 1 new card slot remains: 1 new card + 1 due review = 2 total
    expect(queue).toHaveLength(2);

    const slugs = queue.map((card) => card.slug);
    // Should have due1 (review) and one of the new cards
    expect(slugs).toContain('due1');
    expect(slugs.some((s) => s === 'new1' || s === 'new2')).toBe(true);
    expect(slugs).not.toContain('future1');
    expect(slugs).toHaveLength(2);
  });

  it('should respect MAX_NEW_CARDS_PER_DAY limit', async () => {
    // Create many new cards
    for (let i = 1; i <= 10; i++) {
      await addCard(`new${i}`, `New ${i}`, `${6000 + i}`, 'Medium');
    }

    const queue = await getReviewQueue();

    // Should only include MAX_NEW_CARDS_PER_DAY new cards
    expect(queue).toHaveLength(MAX_NEW_CARDS_PER_DAY);
    expect(queue.every((card) => card.fsrs.state === FsrsState.New)).toBe(true);
  });

  it('should include all due review cards regardless of limit', async () => {
    // Create many review cards
    for (let i = 1; i <= 10; i++) {
      await addCard(`review${i}`, `Review ${i}`, `${7000 + i}`, 'Medium');
      await rateCard(`review${i}`, `Review ${i}`, Rating.Good, `${7000 + i}`, 'Medium');
    }

    // Set all to be due
    const cards = await storage.getItem<Record<string, StoredCard>>(STORAGE_KEYS.cards);
    const pastTime = new Date('2024-01-14T12:00:00Z').getTime();
    for (let i = 1; i <= 10; i++) {
      cards![`review${i}`].fsrs.due = pastTime;
    }
    await storage.setItem(STORAGE_KEYS.cards, cards);

    const queue = await getReviewQueue();

    // Should include all 10 review cards (no limit on reviews)
    expect(queue).toHaveLength(10);
    expect(queue.every((card) => card.fsrs.state !== FsrsState.New)).toBe(true);
  });

  it('should respect daily new cards already completed when building queue', async () => {
    // Create stats showing 1 new card already done today
    await storage.setItem(
      STORAGE_KEYS.stats,
      createTestStats({
        newCards: 1,
        gradeBreakdown: {
          [Rating.Again]: 0,
          [Rating.Hard]: 0,
          [Rating.Good]: 1,
          [Rating.Easy]: 0,
        },
      })
    );

    // Create 5 new cards
    for (let i = 1; i <= 5; i++) {
      await addCard(`new${i}`, `New ${i}`, `${6000 + i}`, 'Medium');
    }

    const queue = await getReviewQueue();

    // Should only get (MAX_NEW_CARDS_PER_DAY - 1) since 1 was already done
    expect(queue).toHaveLength(MAX_NEW_CARDS_PER_DAY - 1);
    expect(queue.every((card) => card.fsrs.state === FsrsState.New)).toBe(true);
  });

  it('should return no new cards when daily limit already reached', async () => {
    // Create stats showing MAX_NEW_CARDS_PER_DAY already done
    await storage.setItem(
      STORAGE_KEYS.stats,
      createTestStats({
        newCards: MAX_NEW_CARDS_PER_DAY,
        gradeBreakdown: {
          [Rating.Again]: 0,
          [Rating.Hard]: 0,
          [Rating.Good]: MAX_NEW_CARDS_PER_DAY,
          [Rating.Easy]: 0,
        },
      })
    );

    // Create new cards
    for (let i = 1; i <= 5; i++) {
      await addCard(`new${i}`, `New ${i}`, `${8000 + i}`, 'Easy');
    }

    const queue = await getReviewQueue();

    // Should have no cards since daily limit reached
    expect(queue).toHaveLength(0);
  });

  it('should still include review cards when new card limit is reached', async () => {
    // Create stats showing new card limit reached
    await storage.setItem(
      STORAGE_KEYS.stats,
      createTestStats({
        newCards: MAX_NEW_CARDS_PER_DAY,
        reviewedCards: 2,
        totalReviews: MAX_NEW_CARDS_PER_DAY + 2,
        gradeBreakdown: {
          [Rating.Again]: 0,
          [Rating.Hard]: 2,
          [Rating.Good]: MAX_NEW_CARDS_PER_DAY,
          [Rating.Easy]: 0,
        },
      })
    );

    // Create new cards (won't be included)
    await addCard('new1', 'New 1', '2001', 'Easy');
    await addCard('new2', 'New 2', '2002', 'Medium');

    // Create review cards (should be included)
    await addCard('review1', 'Review 1', '3001', 'Medium');
    await addCard('review2', 'Review 2', '3002', 'Hard');
    await rateCard('review1', 'Review 1', Rating.Good, '3001', 'Medium');
    await rateCard('review2', 'Review 2', Rating.Good, '3002', 'Hard');

    // Set review cards to be due
    const cards = await storage.getItem<Record<string, StoredCard>>(STORAGE_KEYS.cards);
    const pastTime = new Date('2024-01-14T12:00:00Z').getTime();
    cards!['review1'].fsrs.due = pastTime;
    cards!['review2'].fsrs.due = pastTime;
    await storage.setItem(STORAGE_KEYS.cards, cards);

    const queue = await getReviewQueue();

    // Should only have the 2 review cards
    expect(queue).toHaveLength(2);
    expect(queue.every((card) => card.fsrs.state !== FsrsState.New)).toBe(true);
  });

  it('should handle partial new card limit correctly', async () => {
    // Set MAX_NEW_CARDS_PER_DAY = 3, already did 2
    await storage.setItem(
      STORAGE_KEYS.stats,
      createTestStats({
        newCards: 2,
        gradeBreakdown: {
          [Rating.Again]: 0,
          [Rating.Hard]: 0,
          [Rating.Good]: 2,
          [Rating.Easy]: 0,
        },
      })
    );

    // Create 10 new cards
    for (let i = 1; i <= 10; i++) {
      await addCard(`new${i}`, `New ${i}`, `${6000 + i}`, 'Medium');
    }

    const queue = await getReviewQueue();

    // Should only get 1 more new card (3 - 2 = 1)
    expect(queue).toHaveLength(1);
    expect(queue[0].fsrs.state).toBe(FsrsState.New);
  });

  it('should handle no stats (first use) correctly', async () => {
    // No stats exist (getTodayStats returns null)

    // Create new cards
    for (let i = 1; i <= 5; i++) {
      await addCard(`new${i}`, `New ${i}`, `${8000 + i}`, 'Easy');
    }

    const queue = await getReviewQueue();

    // Should get full MAX_NEW_CARDS_PER_DAY when no stats exist
    expect(queue).toHaveLength(MAX_NEW_CARDS_PER_DAY);
    expect(queue.every((card) => card.fsrs.state === FsrsState.New)).toBe(true);
  });
});
