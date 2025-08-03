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
  type Card,
  type StoredCard,
} from '../cards';
import { STORAGE_KEYS } from '../storage-keys';
import { createEmptyCard, Rating, State as FsrsState } from 'ts-fsrs';
import type { DailyStats } from '../stats';

describe('Card serialization', () => {
  describe('serializeCard', () => {
    it('should convert Date to timestamp', () => {
      const testDate = new Date('2024-01-15T10:30:00Z');
      const card: Card = {
        slug: 'two-sum',
        name: 'Two Sum',
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
        slug: 'two-sum',
        name: 'Two Sum',
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
        slug: 'merge-intervals',
        name: 'Merge Intervals',
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
        slug: 'two-pointers',
        name: 'Two Pointers',
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
    const card = await addCard('two-sum', 'Two Sum');

    expect(card.slug).toBe('two-sum');
    expect(card.name).toBe('Two Sum');
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
    const firstCard = await addCard('valid-parentheses', 'Valid Parentheses');
    const firstCreatedAt = firstCard.createdAt;

    // Add same card again
    const secondCard = await addCard('valid-parentheses', 'A different name');

    // Should return the same card
    expect(secondCard.slug).toBe('valid-parentheses');
    expect(secondCard.createdAt.getTime()).toBe(firstCreatedAt.getTime());
    expect(secondCard.name).toBe('Valid Parentheses');

    // Verify only one card exists in storage
    const cards = await storage.getItem<Record<string, StoredCard>>(STORAGE_KEYS.cards);

    expect(Object.keys(cards || {}).length).toBe(1);
  });

  it('should store multiple different cards correctly', async () => {
    // Add multiple cards
    await addCard('two-sum', 'Two Sum');
    await addCard('valid-parentheses', 'Valid Parentheses');
    await addCard('merge-two-sorted-lists', 'Merge Two Sorted Lists');

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
    const card = await addCard('test-problem', 'Test Problem');
    const afterTime = new Date();

    expect(card.createdAt).toBeInstanceOf(Date);
    expect(card.createdAt.getTime()).toBeGreaterThanOrEqual(beforeTime.getTime());
    expect(card.createdAt.getTime()).toBeLessThanOrEqual(afterTime.getTime());
  });

  it('should properly serialize card when storing', async () => {
    const card = await addCard('serialize-test', 'Serialize Test');

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
    await addCard('two-sum', 'Two Sum');
    await addCard('valid-parentheses', 'Valid Parentheses');
    await addCard('merge-intervals', 'Merge Intervals');

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
      slug: 'test-problem',
      name: 'Test Problem',
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
    await addCard('two-sum', 'Two Sum');

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
    await addCard('two-sum', 'Two Sum');
    await addCard('valid-parentheses', 'Valid Parentheses');
    await addCard('merge-intervals', 'Merge Intervals');

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
    await addCard('two-sum', 'Two Sum');
    await addCard('valid-parentheses', 'Valid Parentheses');
    await addCard('merge-intervals', 'Merge Intervals');

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
    const card = await rateCard('new-problem', Rating.Good);

    expect(card.slug).toBe('new-problem');
    expect(card.name).toBe('new-problem');
    expect(card.createdAt).toBeInstanceOf(Date);
    expect(card.fsrs).toBeDefined();

    // Verify the card was stored
    const cards = await storage.getItem<Record<string, StoredCard>>(STORAGE_KEYS.cards);
    expect(cards!['new-problem']).toBeDefined();
  });

  it('should update existing card when rating', async () => {
    // First create a card
    const initialCard = await addCard('two-sum', 'Two Sum');
    const initialReps = initialCard.fsrs.reps;
    const initialStability = initialCard.fsrs.stability;

    // Rate the card as Good
    const ratedCard = await rateCard('two-sum', Rating.Good);

    expect(ratedCard.slug).toBe('two-sum');
    expect(ratedCard.name).toBe('Two Sum');

    // FSRS should update the card
    expect(ratedCard.fsrs.reps).toBeGreaterThan(initialReps);
    expect(ratedCard.fsrs.stability).not.toBe(initialStability);
    expect(ratedCard.fsrs.last_review).toBeInstanceOf(Date);
  });

  it('should handle different grades correctly', async () => {
    // Create a card
    await addCard('test-problem', 'Test Problem');

    // Rate as Again (fail)
    const failedCard = await rateCard('test-problem', Rating.Again);
    expect(failedCard.fsrs.reps).toBe(1);
    expect(failedCard.fsrs.lapses).toBe(0);

    // Rate as Easy
    const easyCard = await rateCard('test-problem', Rating.Easy);
    expect(easyCard.fsrs.reps).toBeGreaterThan(0);
  });

  it('should update the due date after rating', async () => {
    const card = await addCard('merge-sort', 'Merge Sort');
    const initialDue = card.fsrs.due;

    const ratedCard = await rateCard('merge-sort', Rating.Good);

    expect(ratedCard.fsrs.due).toBeInstanceOf(Date);
    expect(ratedCard.fsrs.due.getTime()).toBeGreaterThan(initialDue.getTime());
  });

  it('should persist card updates to storage', async () => {
    await addCard('binary-search', 'Binary Search');

    // Rate the card
    await rateCard('binary-search', Rating.Hard);

    // Verify the updated card is in storage
    const cards = await storage.getItem<Record<string, StoredCard>>(STORAGE_KEYS.cards);
    const storedCard = cards!['binary-search'];

    expect(storedCard).toBeDefined();
    expect(typeof storedCard.fsrs.last_review).toBe('number');
  });

  it('should handle multiple ratings on the same card', async () => {
    const slug = 'dynamic-programming';

    // First rating (creates card)
    const card1 = await rateCard(slug, Rating.Again);
    expect(card1.fsrs.reps).toBe(1);
    expect(card1.fsrs.lapses).toBe(0);

    // Second rating
    const card2 = await rateCard(slug, Rating.Hard);
    expect(card2.fsrs.reps).toBeGreaterThan(0);

    // Third rating
    const card3 = await rateCard(slug, Rating.Good);
    expect(card3.fsrs.reps).toBeGreaterThan(card2.fsrs.reps);

    // Verify only one card exists in storage
    const allCards = await getAllCards();
    const dpCards = allCards.filter((c) => c.slug === slug);
    expect(dpCards).toHaveLength(1);
  });

  it('should update stats when rating a new card', async () => {
    // Rate a new card (doesn't exist yet)
    await rateCard('new-problem', Rating.Good);

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
    await addCard('test-card', 'Test Card');

    // First rating (card is new)
    await rateCard('test-card', Rating.Good);

    let stats = await storage.getItem<Record<string, DailyStats>>(STORAGE_KEYS.stats);
    let todayStats = stats?.['2024-03-15'];

    expect(todayStats?.totalReviews).toBe(1);
    expect(todayStats?.newCards).toBe(1);
    expect(todayStats?.reviewedCards).toBe(0);

    // Second rating (card is now a review card)
    await rateCard('test-card', Rating.Hard);

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
    await addCard('problem1', 'Problem 1');
    await addCard('problem2', 'Problem 2');
    await addCard('problem3', 'Problem 3');
    await addCard('problem4', 'Problem 4');
    await addCard('problem5', 'Problem 5');

    const queue = await getReviewQueue();

    // Should only get MAX_NEW_CARDS_PER_DAY
    expect(queue).toHaveLength(MAX_NEW_CARDS_PER_DAY);
    expect(queue.every((card) => card.fsrs.state === FsrsState.New)).toBe(true);
  });

  it('should return only review cards when they are due', async () => {
    // Create and rate cards to make them review cards
    await addCard('problem1', 'Problem 1');
    await addCard('problem2', 'Problem 2');

    // Rate them to move out of New state
    await rateCard('problem1', Rating.Good);
    await rateCard('problem2', Rating.Good);

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
    await addCard('new1', 'New 1');
    await addCard('new2', 'New 2');
    await addCard('new3', 'New 3');
    await addCard('new4', 'New 4'); // This won't be included (exceeds limit)

    // Create some review cards
    await addCard('review1', 'Review 1');
    await addCard('review2', 'Review 2');

    // Rate review cards to move them out of New state
    await rateCard('review1', Rating.Good);
    await rateCard('review2', Rating.Good);

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
    await addCard('future1', 'Future 1');
    await rateCard('future1', Rating.Good);

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
    await addCard('new1', 'New 1');
    await addCard('new2', 'New 2');

    // Create due review cards
    await addCard('due1', 'Due 1');
    await rateCard('due1', Rating.Good);

    // Create future review cards
    await addCard('future1', 'Future 1');
    await rateCard('future1', Rating.Easy);

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
      await addCard(`new${i}`, `New ${i}`);
    }

    const queue = await getReviewQueue();

    // Should only include MAX_NEW_CARDS_PER_DAY new cards
    expect(queue).toHaveLength(MAX_NEW_CARDS_PER_DAY);
    expect(queue.every((card) => card.fsrs.state === FsrsState.New)).toBe(true);
  });

  it('should include all due review cards regardless of limit', async () => {
    // Create many review cards
    for (let i = 1; i <= 10; i++) {
      await addCard(`review${i}`, `Review ${i}`);
      await rateCard(`review${i}`, Rating.Good);
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
      await addCard(`new${i}`, `New ${i}`);
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
      await addCard(`new${i}`, `New ${i}`);
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
    await addCard('new1', 'New 1');
    await addCard('new2', 'New 2');

    // Create review cards (should be included)
    await addCard('review1', 'Review 1');
    await addCard('review2', 'Review 2');
    await rateCard('review1', Rating.Good);
    await rateCard('review2', Rating.Good);

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
      await addCard(`new${i}`, `New ${i}`);
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
      await addCard(`new${i}`, `New ${i}`);
    }

    const queue = await getReviewQueue();

    // Should get full MAX_NEW_CARDS_PER_DAY when no stats exist
    expect(queue).toHaveLength(MAX_NEW_CARDS_PER_DAY);
    expect(queue.every((card) => card.fsrs.state === FsrsState.New)).toBe(true);
  });
});
