import { createEmptyCard, State as FsrsState, Rating } from 'ts-fsrs';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fakeBrowser } from 'wxt/testing/fake-browser';
import { storage } from 'wxt/utils/storage';
import type { Card } from '@/shared/cards';
import { DEFAULT_MAX_NEW_CARDS_PER_DAY } from '@/shared/settings';
import { requireDefined } from '@/test/utils/assertions';
import {
  addCard,
  delayCard,
  deserializeCard,
  getAllCards,
  getReviewQueue,
  isDueByDate,
  rateCard,
  removeCard,
  type StoredCard,
  serializeCard,
  setPauseStatus,
} from '../cards';
import * as notesModule from '../notes';
import type { DailyStats } from '../stats';
import { STORAGE_KEYS } from '../storage-keys';

// Mock the notes module
vi.mock('../notes', () => ({
  deleteNote: vi.fn(),
}));

// Mock the settings module
vi.mock('../settings', () => ({
  getMaxNewCardsPerDay: vi.fn(() => Promise.resolve(3)),
  setMaxNewCardsPerDay: vi.fn(),
  getDayStartHour: vi.fn(() => Promise.resolve(0)),
  setDayStartHour: vi.fn(),
}));

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
        paused: false,
        domain: 'leetcode.com',
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
        paused: false,
        domain: 'leetcode.com',
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
        paused: false,
        domain: 'leetcode.com',
      };

      const deserialized = deserializeCard(storedCard);

      expect(deserialized.slug).toBe('merge-intervals');
      expect(deserialized.name).toBe('Merge Intervals');
      expect(deserialized.createdAt).toBeInstanceOf(Date);
      expect(deserialized.createdAt.getTime()).toBe(timestamp);
    });

    it('should default domain to leetcode.com when missing', () => {
      const timestamp = new Date('2024-01-15T10:30:00Z').getTime();
      const emptyFsrs = createEmptyCard();
      // Simulate a pre-migration stored card that lacks the domain field
      const storedCard = {
        id: 'test-id-old',
        slug: 'old-problem',
        name: 'Old Problem',
        leetcodeId: '100',
        difficulty: 'Easy',
        createdAt: timestamp,
        fsrs: {
          ...emptyFsrs,
          due: emptyFsrs.due.getTime(),
          last_review: emptyFsrs.last_review?.getTime(),
        },
        paused: false,
      } as unknown as StoredCard;

      const deserialized = deserializeCard(storedCard);

      expect(deserialized.domain).toBe('leetcode.com');
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
        paused: false,
        domain: 'leetcode.com',
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
    const card = await addCard({
      slug: 'two-sum',
      name: 'Two Sum',
      leetcodeId: '1',
      difficulty: 'Easy',
      domain: 'leetcode.com',
    });

    expect(card.id).toBeDefined();
    expect(card.id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i);
    expect(card.slug).toBe('two-sum');
    expect(card.name).toBe('Two Sum');
    expect(card.difficulty).toBe('Easy');
    expect(card.domain).toBe('leetcode.com');
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
    expect(requireDefined(cards)['two-sum']).toBeDefined();
    expect(requireDefined(cards)['two-sum'].slug).toBe('two-sum');
    expect(requireDefined(cards)['two-sum'].name).toBe('Two Sum');

    // Verify FSRS data is stored properly
    expect(requireDefined(cards)['two-sum'].fsrs).toBeDefined();
    expect(typeof requireDefined(cards)['two-sum'].fsrs.due).toBe('number');
  });

  it('should return existing card when adding same slug (idempotent)', async () => {
    // Add card first time
    const firstCard = await addCard({
      slug: 'valid-parentheses',
      name: 'Valid Parentheses',
      leetcodeId: '20',
      difficulty: 'Medium',
      domain: 'leetcode.com',
    });
    const firstCreatedAt = firstCard.createdAt;
    const firstId = firstCard.id;

    // Add same card again
    const secondCard = await addCard({
      slug: 'valid-parentheses',
      name: 'A different name',
      leetcodeId: '20',
      difficulty: 'Hard',
      domain: 'leetcode.com',
    });

    // Should return the same card
    expect(secondCard.id).toBe(firstId);
    expect(secondCard.slug).toBe('valid-parentheses');
    expect(secondCard.createdAt.getTime()).toBe(firstCreatedAt.getTime());
    expect(secondCard.name).toBe('Valid Parentheses');
    expect(secondCard.difficulty).toBe('Medium');
    expect(secondCard.domain).toBe('leetcode.com');

    // Verify only one card exists in storage
    const cards = await storage.getItem<Record<string, StoredCard>>(STORAGE_KEYS.cards);

    expect(Object.keys(cards || {}).length).toBe(1);
  });

  it('should store multiple different cards correctly', async () => {
    // Add multiple cards
    await addCard({ slug: 'two-sum', name: 'Two Sum', leetcodeId: '1', difficulty: 'Easy', domain: 'leetcode.com' });
    await addCard({
      slug: 'valid-parentheses',
      name: 'Valid Parentheses',
      leetcodeId: '20',
      difficulty: 'Medium',
      domain: 'leetcode.com',
    });
    await addCard({
      slug: 'merge-two-sorted-lists',
      name: 'Merge Two Sorted Lists',
      leetcodeId: '21',
      difficulty: 'Hard',
      domain: 'leetcode.com',
    });

    // Verify all cards are stored
    const cards = await storage.getItem<Record<string, StoredCard>>(STORAGE_KEYS.cards);

    expect(Object.keys(cards || {}).length).toBe(3);

    // Verify cards exist
    expect(requireDefined(cards)['two-sum']).toBeDefined();
    expect(requireDefined(cards)['valid-parentheses']).toBeDefined();
    expect(requireDefined(cards)['merge-two-sorted-lists']).toBeDefined();
  });

  it('should set createdAt to current date', async () => {
    const beforeTime = new Date();
    const card = await addCard({
      slug: 'test-problem',
      name: 'Test Problem',
      leetcodeId: '999',
      difficulty: 'Medium',
      domain: 'leetcode.com',
    });
    const afterTime = new Date();

    expect(card.createdAt).toBeInstanceOf(Date);
    expect(card.createdAt.getTime()).toBeGreaterThanOrEqual(beforeTime.getTime());
    expect(card.createdAt.getTime()).toBeLessThanOrEqual(afterTime.getTime());
  });

  it('should properly serialize card when storing', async () => {
    const card = await addCard({
      slug: 'serialize-test',
      name: 'Serialize Test',
      leetcodeId: '1000',
      difficulty: 'Easy',
      domain: 'leetcode.com',
    });

    const cards = await storage.getItem<Record<string, StoredCard>>(STORAGE_KEYS.cards);
    const storedCard = requireDefined(cards)[card.slug];

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
    await addCard({ slug: 'two-sum', name: 'Two Sum', leetcodeId: '1', difficulty: 'Easy', domain: 'leetcode.com' });
    await addCard({
      slug: 'valid-parentheses',
      name: 'Valid Parentheses',
      leetcodeId: '20',
      difficulty: 'Medium',
      domain: 'leetcode.com',
    });
    await addCard({
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

describe('removeCard', () => {
  beforeEach(() => {
    // Reset the fake browser state before each test
    fakeBrowser.reset();
  });

  it('should remove an existing card and its slug mapping', async () => {
    // Add a card first
    await addCard({ slug: 'two-sum', name: 'Two Sum', leetcodeId: '1', difficulty: 'Easy', domain: 'leetcode.com' });

    // Verify it exists
    let cards = await storage.getItem<Record<string, StoredCard>>(STORAGE_KEYS.cards);
    expect(requireDefined(cards)['two-sum']).toBeDefined();

    // Remove the card
    await removeCard('two-sum');

    // Verify it's removed
    cards = await storage.getItem<Record<string, StoredCard>>(STORAGE_KEYS.cards);
    expect(requireDefined(cards)['two-sum']).toBeUndefined();
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
    await addCard({ slug: 'two-sum', name: 'Two Sum', leetcodeId: '1', difficulty: 'Easy', domain: 'leetcode.com' });
    await addCard({
      slug: 'valid-parentheses',
      name: 'Valid Parentheses',
      leetcodeId: '20',
      difficulty: 'Medium',
      domain: 'leetcode.com',
    });
    await addCard({
      slug: 'merge-intervals',
      name: 'Merge Intervals',
      leetcodeId: '56',
      difficulty: 'Hard',
      domain: 'leetcode.com',
    });

    // Remove the middle card
    await removeCard('valid-parentheses');

    // Verify only the specified card is removed
    const cards = await storage.getItem<Record<string, StoredCard>>(STORAGE_KEYS.cards);

    expect(Object.keys(cards || {}).length).toBe(2);

    // Card 1 should still exist
    expect(requireDefined(cards)['two-sum']).toBeDefined();

    // Card 2 should be removed
    expect(requireDefined(cards)['valid-parentheses']).toBeUndefined();

    // Card 3 should still exist
    expect(requireDefined(cards)['merge-intervals']).toBeDefined();
  });

  it('should verify card is actually removed from getAllCards', async () => {
    // Add multiple cards
    await addCard({ slug: 'two-sum', name: 'Two Sum', leetcodeId: '1', difficulty: 'Easy', domain: 'leetcode.com' });
    await addCard({
      slug: 'valid-parentheses',
      name: 'Valid Parentheses',
      leetcodeId: '20',
      difficulty: 'Medium',
      domain: 'leetcode.com',
    });
    await addCard({
      slug: 'merge-intervals',
      name: 'Merge Intervals',
      leetcodeId: '56',
      difficulty: 'Hard',
      domain: 'leetcode.com',
    });

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

  it('should delete associated note when removing a card', async () => {
    // Clear any previous mock calls
    vi.clearAllMocks();

    // Add a card
    const card = await addCard({
      slug: 'test-with-note',
      name: 'Test With Note',
      leetcodeId: '123',
      difficulty: 'Medium',
      domain: 'leetcode.com',
    });
    const cardId = card.id;

    // Remove the card
    await removeCard('test-with-note');

    // Verify deleteNote was called with the correct card ID
    expect(notesModule.deleteNote).toHaveBeenCalledTimes(1);
    expect(notesModule.deleteNote).toHaveBeenCalledWith(cardId);

    // Verify the card is actually removed
    const cards = await storage.getItem<Record<string, StoredCard>>(STORAGE_KEYS.cards);
    expect(requireDefined(cards)['test-with-note']).toBeUndefined();
  });

  it('should not call deleteNote when removing non-existent card', async () => {
    // Clear any previous mock calls
    vi.clearAllMocks();

    // Try to remove a card that doesn't exist
    await removeCard('non-existent-card');

    // Verify deleteNote was NOT called
    expect(notesModule.deleteNote).not.toHaveBeenCalled();
  });
});

describe('delayCard', () => {
  beforeEach(() => {
    // Reset the fake browser state before each test
    fakeBrowser.reset();
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2024-03-15T10:00:00'));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('should delay card due date by specified number of days', async () => {
    // Create a card first
    const card = await addCard({
      slug: 'two-sum',
      name: 'Two Sum',
      leetcodeId: '1',
      difficulty: 'Easy',
      domain: 'leetcode.com',
    });
    const originalDueDate = new Date(card.fsrs.due);

    // Delay the card by 5 days
    const delayedCard = await delayCard('two-sum', 5);

    // Check that the due date was updated
    const expectedDueDate = new Date(originalDueDate);
    expectedDueDate.setDate(expectedDueDate.getDate() + 5);

    expect(delayedCard.fsrs.due).toBeInstanceOf(Date);
    expect(delayedCard.fsrs.due.getTime()).toBe(expectedDueDate.getTime());

    // Verify it was persisted to storage
    const cards = await storage.getItem<Record<string, StoredCard>>(STORAGE_KEYS.cards);
    const storedCard = requireDefined(cards)['two-sum'];
    expect(storedCard.fsrs.due).toBe(expectedDueDate.getTime());
  });

  it('should handle delaying by 1 day', async () => {
    const card = await addCard({
      slug: 'test-problem',
      name: 'Test Problem',
      leetcodeId: '999',
      difficulty: 'Medium',
      domain: 'leetcode.com',
    });
    const originalDueDate = new Date(card.fsrs.due);

    const delayedCard = await delayCard('test-problem', 1);

    const expectedDueDate = new Date(originalDueDate);
    expectedDueDate.setDate(expectedDueDate.getDate() + 1);

    expect(delayedCard.fsrs.due.getTime()).toBe(expectedDueDate.getTime());
  });

  it('should handle delaying by large number of days', async () => {
    const card = await addCard({
      slug: 'large-delay',
      name: 'Large Delay',
      leetcodeId: '1000',
      difficulty: 'Hard',
      domain: 'leetcode.com',
    });
    const originalDueDate = new Date(card.fsrs.due);

    const delayedCard = await delayCard('large-delay', 30);

    const expectedDueDate = new Date(originalDueDate);
    expectedDueDate.setDate(expectedDueDate.getDate() + 30);

    expect(delayedCard.fsrs.due.getTime()).toBe(expectedDueDate.getTime());
  });

  it('should throw error when card does not exist', async () => {
    await expect(delayCard('non-existent-card', 5)).rejects.toThrow('Card with slug "non-existent-card" not found');
  });

  it('should preserve all other card properties when delaying', async () => {
    await addCard({
      slug: 'preserve-props',
      name: 'Preserve Props',
      leetcodeId: '2000',
      difficulty: 'Medium',
      domain: 'leetcode.com',
    });

    // Rate the card first to change some FSRS properties
    await rateCard({
      slug: 'preserve-props',
      name: 'Preserve Props',
      rating: Rating.Good,
      leetcodeId: '2000',
      difficulty: 'Medium',
      domain: 'leetcode.com',
    });

    // Get the updated card
    const ratedCards = await getAllCards();
    const ratedCard = requireDefined(ratedCards.find((c) => c.slug === 'preserve-props'));

    // Delay the card
    const delayedCard = await delayCard('preserve-props', 7);

    // Check that all properties except due date are preserved
    expect(delayedCard.id).toBe(ratedCard.id);
    expect(delayedCard.slug).toBe(ratedCard.slug);
    expect(delayedCard.name).toBe(ratedCard.name);
    expect(delayedCard.leetcodeId).toBe(ratedCard.leetcodeId);
    expect(delayedCard.difficulty).toBe(ratedCard.difficulty);
    expect(delayedCard.createdAt.getTime()).toBe(ratedCard.createdAt.getTime());

    // FSRS properties except due should be preserved
    expect(delayedCard.fsrs.state).toBe(ratedCard.fsrs.state);
    expect(delayedCard.fsrs.reps).toBe(ratedCard.fsrs.reps);
    expect(delayedCard.fsrs.lapses).toBe(ratedCard.fsrs.lapses);
    expect(delayedCard.fsrs.stability).toBe(ratedCard.fsrs.stability);
    expect(delayedCard.fsrs.difficulty).toBe(ratedCard.fsrs.difficulty);
    expect(delayedCard.fsrs.last_review?.getTime()).toBe(ratedCard.fsrs.last_review?.getTime());

    // Only due date should be different
    expect(delayedCard.fsrs.due.getTime()).not.toBe(ratedCard.fsrs.due.getTime());
  });

  it('should handle multiple delays on the same card', async () => {
    await addCard({
      slug: 'multi-delay',
      name: 'Multi Delay',
      leetcodeId: '3000',
      difficulty: 'Easy',
      domain: 'leetcode.com',
    });

    // First delay by 2 days
    const firstDelay = await delayCard('multi-delay', 2);
    const firstDueDate = new Date(firstDelay.fsrs.due);

    // Second delay by 3 more days
    const secondDelay = await delayCard('multi-delay', 3);

    // Should be 3 days after the first delayed date, not 5 days from original
    const expectedDueDate = new Date(firstDueDate);
    expectedDueDate.setDate(expectedDueDate.getDate() + 3);

    expect(secondDelay.fsrs.due.getTime()).toBe(expectedDueDate.getTime());
  });

  it('should work with cards in different states', async () => {
    // Test with a new card
    await addCard({
      slug: 'new-card',
      name: 'New Card',
      leetcodeId: '4000',
      difficulty: 'Medium',
      domain: 'leetcode.com',
    });
    const delayedNew = await delayCard('new-card', 10);
    expect(delayedNew.fsrs.state).toBe(FsrsState.New);

    // Test with a learning card
    await rateCard({
      slug: 'new-card',
      name: 'New Card',
      rating: Rating.Again,
      leetcodeId: '4000',
      difficulty: 'Medium',
      domain: 'leetcode.com',
    });
    const learningCards = await getAllCards();
    const learningCard = requireDefined(learningCards.find((c) => c.slug === 'new-card'));

    const delayedLearning = await delayCard('new-card', 5);
    expect(delayedLearning.fsrs.state).toBe(learningCard.fsrs.state);
  });
});

describe('setPauseStatus', () => {
  beforeEach(() => {
    fakeBrowser.reset();
  });

  it('should set pause status to true', async () => {
    await addCard({
      slug: 'set-pause-true',
      name: 'Set Pause True',
      leetcodeId: '4500',
      difficulty: 'Easy',
      domain: 'leetcode.com',
    });

    const pausedCard = await setPauseStatus('set-pause-true', true);

    expect(pausedCard.paused).toBe(true);

    // Verify persistence
    const allCards = await getAllCards();
    const card = allCards.find((c) => c.slug === 'set-pause-true');
    expect(card?.paused).toBe(true);
  });

  it('should set pause status to false', async () => {
    await addCard({
      slug: 'set-pause-false',
      name: 'Set Pause False',
      leetcodeId: '4501',
      difficulty: 'Medium',
      domain: 'leetcode.com',
    });
    // First pause it
    await setPauseStatus('set-pause-false', true);

    // Then unpause it
    const unpausedCard = await setPauseStatus('set-pause-false', false);

    expect(unpausedCard.paused).toBe(false);

    // Verify persistence
    const allCards = await getAllCards();
    const card = allCards.find((c) => c.slug === 'set-pause-false');
    expect(card?.paused).toBe(false);
  });

  it('should throw error for non-existent card', async () => {
    await expect(setPauseStatus('non-existent', true)).rejects.toThrow('Card with slug "non-existent" not found');
    await expect(setPauseStatus('non-existent', false)).rejects.toThrow('Card with slug "non-existent" not found');
  });
});

describe('setPauseStatus - pausing', () => {
  beforeEach(() => {
    fakeBrowser.reset();
  });

  it('should pause an existing card', async () => {
    await addCard({
      slug: 'pause-test',
      name: 'Pause Test',
      leetcodeId: '5000',
      difficulty: 'Easy',
      domain: 'leetcode.com',
    });

    const pausedCard = await setPauseStatus('pause-test', true);

    expect(pausedCard.paused).toBe(true);
    expect(pausedCard.slug).toBe('pause-test');

    // Verify it's persisted
    const allCards = await getAllCards();
    const card = allCards.find((c) => c.slug === 'pause-test');
    expect(card?.paused).toBe(true);
  });

  it('should throw error when pausing non-existent card', async () => {
    await expect(setPauseStatus('non-existent', true)).rejects.toThrow('Card with slug "non-existent" not found');
  });

  it('should handle pausing already paused card', async () => {
    await addCard({
      slug: 'already-paused',
      name: 'Already Paused',
      leetcodeId: '5001',
      difficulty: 'Medium',
      domain: 'leetcode.com',
    });

    // Pause once
    await setPauseStatus('already-paused', true);

    // Pause again
    const stillPausedCard = await setPauseStatus('already-paused', true);
    expect(stillPausedCard.paused).toBe(true);
  });
});

describe('setPauseStatus - unpausing', () => {
  beforeEach(() => {
    fakeBrowser.reset();
  });

  it('should unpause a paused card', async () => {
    await addCard({
      slug: 'unpause-test',
      name: 'Unpause Test',
      leetcodeId: '5002',
      difficulty: 'Hard',
      domain: 'leetcode.com',
    });
    await setPauseStatus('unpause-test', true);

    const unpausedCard = await setPauseStatus('unpause-test', false);

    expect(unpausedCard.paused).toBe(false);
    expect(unpausedCard.slug).toBe('unpause-test');

    // Verify it's persisted
    const allCards = await getAllCards();
    const card = allCards.find((c) => c.slug === 'unpause-test');
    expect(card?.paused).toBe(false);
  });

  it('should throw error when unpausing non-existent card', async () => {
    await expect(setPauseStatus('non-existent', false)).rejects.toThrow('Card with slug "non-existent" not found');
  });

  it('should handle unpausing already unpaused card', async () => {
    await addCard({
      slug: 'already-unpaused',
      name: 'Already Unpaused',
      leetcodeId: '5003',
      difficulty: 'Easy',
      domain: 'leetcode.com',
    });

    // Card starts unpaused, unpause it anyway
    const unpausedCard = await setPauseStatus('already-unpaused', false);
    expect(unpausedCard.paused).toBe(false);
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
    const result = await rateCard({
      slug: 'new-problem',
      name: 'New Problem',
      rating: Rating.Good,
      leetcodeId: '9999',
      difficulty: 'Medium',
      domain: 'leetcode.com',
    });

    expect(result.card.slug).toBe('new-problem');
    expect(result.card.name).toBe('New Problem');
    expect(result.card.createdAt).toBeInstanceOf(Date);
    expect(result.card.fsrs).toBeDefined();

    // Verify the card was stored
    const cards = await storage.getItem<Record<string, StoredCard>>(STORAGE_KEYS.cards);
    expect(requireDefined(cards)['new-problem']).toBeDefined();
  });

  it('should update existing card when rating', async () => {
    // First create a card
    const initialCard = await addCard({
      slug: 'two-sum',
      name: 'Two Sum',
      leetcodeId: '1',
      difficulty: 'Easy',
      domain: 'leetcode.com',
    });
    const initialReps = initialCard.fsrs.reps;
    const initialStability = initialCard.fsrs.stability;

    // Rate the card as Good
    const result = await rateCard({
      slug: 'two-sum',
      name: 'Two Sum',
      rating: Rating.Good,
      leetcodeId: '1',
      difficulty: 'Easy',
      domain: 'leetcode.com',
    });

    expect(result.card.slug).toBe('two-sum');
    expect(result.card.name).toBe('Two Sum');

    // FSRS should update the card
    expect(result.card.fsrs.reps).toBeGreaterThan(initialReps);
    expect(result.card.fsrs.stability).not.toBe(initialStability);
    expect(result.card.fsrs.last_review).toBeInstanceOf(Date);
  });

  it('should handle different grades correctly', async () => {
    // Create a card
    await addCard({
      slug: 'test-problem',
      name: 'Test Problem',
      leetcodeId: '999',
      difficulty: 'Medium',
      domain: 'leetcode.com',
    });

    // Rate as Again (fail)
    const failedResult = await rateCard({
      slug: 'test-problem',
      name: 'Test Problem',
      rating: Rating.Again,
      leetcodeId: '999',
      difficulty: 'Medium',
      domain: 'leetcode.com',
    });
    expect(failedResult.card.fsrs.reps).toBe(1);
    expect(failedResult.card.fsrs.lapses).toBe(0);

    // Rate as Easy
    const easyResult = await rateCard({
      slug: 'test-problem',
      name: 'Test Problem',
      rating: Rating.Easy,
      leetcodeId: '999',
      difficulty: 'Medium',
      domain: 'leetcode.com',
    });
    expect(easyResult.card.fsrs.reps).toBeGreaterThan(0);
  });

  it('should update the due date after rating', async () => {
    const card = await addCard({
      slug: 'merge-sort',
      name: 'Merge Sort',
      leetcodeId: '88',
      difficulty: 'Hard',
      domain: 'leetcode.com',
    });
    const initialDue = card.fsrs.due;

    const result = await rateCard({
      slug: 'merge-sort',
      name: 'Merge Sort',
      rating: Rating.Good,
      leetcodeId: '88',
      difficulty: 'Hard',
      domain: 'leetcode.com',
    });

    expect(result.card.fsrs.due).toBeInstanceOf(Date);
    expect(result.card.fsrs.due.getTime()).toBeGreaterThan(initialDue.getTime());
  });

  it('should persist card updates to storage', async () => {
    await addCard({
      slug: 'binary-search',
      name: 'Binary Search',
      leetcodeId: '704',
      difficulty: 'Medium',
      domain: 'leetcode.com',
    });

    // Rate the card
    await rateCard({
      slug: 'binary-search',
      name: 'Binary Search',
      rating: Rating.Hard,
      leetcodeId: '704',
      difficulty: 'Medium',
      domain: 'leetcode.com',
    });

    // Verify the updated card is in storage
    const cards = await storage.getItem<Record<string, StoredCard>>(STORAGE_KEYS.cards);
    const storedCard = requireDefined(cards)['binary-search'];

    expect(storedCard).toBeDefined();
    expect(typeof storedCard.fsrs.last_review).toBe('number');
  });

  it('should handle multiple ratings on the same card', async () => {
    const slug = 'dynamic-programming';

    // First rating (creates card)
    const result1 = await rateCard({
      slug: slug,
      name: 'Multi Rate',
      rating: Rating.Again,
      leetcodeId: '9998',
      difficulty: 'Hard',
      domain: 'leetcode.com',
    });
    expect(result1.card.fsrs.reps).toBe(1);
    expect(result1.card.fsrs.lapses).toBe(0);

    // Second rating
    const result2 = await rateCard({
      slug: slug,
      name: 'Multi Rate',
      rating: Rating.Hard,
      leetcodeId: '9998',
      difficulty: 'Hard',
      domain: 'leetcode.com',
    });
    expect(result2.card.fsrs.reps).toBeGreaterThan(0);

    // Third rating
    const result3 = await rateCard({
      slug: slug,
      name: 'Multi Rate',
      rating: Rating.Good,
      leetcodeId: '9998',
      difficulty: 'Hard',
      domain: 'leetcode.com',
    });
    expect(result3.card.fsrs.reps).toBeGreaterThan(result2.card.fsrs.reps);

    // Verify only one card exists in storage
    const allCards = await getAllCards();
    const dpCards = allCards.filter((c) => c.slug === slug);
    expect(dpCards).toHaveLength(1);
  });

  it('should update stats when rating a new card', async () => {
    // Rate a new card (doesn't exist yet)
    await rateCard({
      slug: 'new-problem',
      name: 'New Problem',
      rating: Rating.Good,
      leetcodeId: '9999',
      difficulty: 'Medium',
      domain: 'leetcode.com',
    });

    // Check that stats were created
    const stats = await storage.getItem<Record<string, DailyStats>>(STORAGE_KEYS.stats);
    const todayStats = stats?.['2024-03-15'];

    expect(todayStats).toBeDefined();
    expect(todayStats?.totalReviews).toBe(1);
    expect(todayStats?.newCards).toBe(1);
    expect(todayStats?.reviewedCards).toBe(0);
    expect(todayStats?.gradeBreakdown[Rating.Good]).toBe(1);
  });

  it('should return shouldRequeue based on whether card is still due today', async () => {
    // Test with Rating.Again - card should still be due today
    const againResult = await rateCard({
      slug: 'test-again',
      name: 'Test Again',
      rating: Rating.Again,
      leetcodeId: '2001',
      difficulty: 'Easy',
      domain: 'leetcode.com',
    });
    expect(againResult.shouldRequeue).toBe(true); // Again typically schedules for same day

    // Test with Rating.Good on a new card - might schedule for tomorrow
    const goodResult = await rateCard({
      slug: 'test-good',
      name: 'Test Good',
      rating: Rating.Good,
      leetcodeId: '2002',
      difficulty: 'Medium',
      domain: 'leetcode.com',
    });
    // New cards rated Good typically get scheduled for the next day or later
    // The exact value depends on FSRS algorithm, but we can verify the field exists
    expect(typeof goodResult.shouldRequeue).toBe('boolean');

    // Test with Rating.Hard - often keeps cards due today
    const hardResult = await rateCard({
      slug: 'test-hard',
      name: 'Test Hard',
      rating: Rating.Hard,
      leetcodeId: '2003',
      difficulty: 'Hard',
      domain: 'leetcode.com',
    });
    expect(typeof hardResult.shouldRequeue).toBe('boolean');
  });

  it('should update stats correctly for review cards vs new cards', async () => {
    // Create a card
    await addCard({
      slug: 'test-card',
      name: 'Test Card',
      leetcodeId: '1000',
      difficulty: 'Easy',
      domain: 'leetcode.com',
    });

    // First rating (card is new)
    await rateCard({
      slug: 'test-card',
      name: 'Test Card',
      rating: Rating.Good,
      leetcodeId: '1000',
      difficulty: 'Easy',
      domain: 'leetcode.com',
    });

    let stats = await storage.getItem<Record<string, DailyStats>>(STORAGE_KEYS.stats);
    let todayStats = stats?.['2024-03-15'];

    expect(todayStats?.totalReviews).toBe(1);
    expect(todayStats?.newCards).toBe(1);
    expect(todayStats?.reviewedCards).toBe(0);

    // Second rating (card is now a review card)
    await rateCard({
      slug: 'test-card',
      name: 'Test Card',
      rating: Rating.Hard,
      leetcodeId: '1000',
      difficulty: 'Easy',
      domain: 'leetcode.com',
    });

    stats = await storage.getItem<Record<string, DailyStats>>(STORAGE_KEYS.stats);
    todayStats = stats?.['2024-03-15'];

    expect(todayStats?.totalReviews).toBe(2);
    expect(todayStats?.newCards).toBe(1); // Still 1, not incremented
    expect(todayStats?.reviewedCards).toBe(1); // Now 1
    expect(todayStats?.gradeBreakdown[Rating.Good]).toBe(1);
    expect(todayStats?.gradeBreakdown[Rating.Hard]).toBe(1);
  });
});

describe('isDueToday', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    // Set a specific local time for testing
    vi.setSystemTime(new Date('2024-01-15T14:30:00')); // 2:30 PM local time
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('should return true for new cards with due date today', () => {
    const newCard: Card = {
      id: 'test-id',
      slug: 'test-problem',
      name: 'Test Problem',
      leetcodeId: '1',
      difficulty: 'Easy',
      createdAt: new Date(),
      fsrs: createEmptyCard(), // createEmptyCard sets due date to now
      paused: false,
      domain: 'leetcode.com',
    };

    expect(isDueByDate(newCard)).toBe(true);
  });

  it('should return true for cards due today (earlier time)', () => {
    const now = new Date();
    const dueToday = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 8, 0, 0); // 8 AM today

    const card: Card = {
      id: 'test-id',
      slug: 'test-problem',
      name: 'Test Problem',
      leetcodeId: '1',
      difficulty: 'Easy',
      createdAt: new Date('2024-01-10'),
      fsrs: {
        ...createEmptyCard(),
        state: FsrsState.Learning,
        due: dueToday,
      },
      paused: false,
      domain: 'leetcode.com',
    };

    expect(isDueByDate(card)).toBe(true);
  });

  it('should return true for cards due today (later time)', () => {
    const now = new Date();
    const dueToday = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59); // 11:59 PM today

    const card: Card = {
      id: 'test-id',
      slug: 'test-problem',
      name: 'Test Problem',
      leetcodeId: '1',
      difficulty: 'Easy',
      createdAt: new Date('2024-01-10'),
      fsrs: {
        ...createEmptyCard(),
        state: FsrsState.Review,
        due: dueToday,
      },
      paused: false,
      domain: 'leetcode.com',
    };

    expect(isDueByDate(card)).toBe(true);
  });

  it('should return true for cards due in the past', () => {
    const now = new Date();
    const yesterday = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1, 10, 0, 0);

    const card: Card = {
      id: 'test-id',
      slug: 'test-problem',
      name: 'Test Problem',
      leetcodeId: '1',
      difficulty: 'Easy',
      createdAt: new Date('2024-01-10'),
      fsrs: {
        ...createEmptyCard(),
        state: FsrsState.Review,
        due: yesterday,
      },
      paused: false,
      domain: 'leetcode.com',
    };

    expect(isDueByDate(card)).toBe(true);
  });

  it('should return false for cards due tomorrow', () => {
    const now = new Date();
    const tomorrow = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1, 0, 0, 1); // 12:00:01 AM tomorrow

    const card: Card = {
      id: 'test-id',
      slug: 'test-problem',
      name: 'Test Problem',
      leetcodeId: '1',
      difficulty: 'Easy',
      createdAt: new Date('2024-01-10'),
      fsrs: {
        ...createEmptyCard(),
        state: FsrsState.Review,
        due: tomorrow,
      },
      paused: false,
      domain: 'leetcode.com',
    };

    expect(isDueByDate(card)).toBe(false);
  });

  it('should return false for cards due in the future', () => {
    const now = new Date();
    const futureDate = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 5, 10, 0, 0); // 5 days from now

    const card: Card = {
      id: 'test-id',
      slug: 'test-problem',
      name: 'Test Problem',
      leetcodeId: '1',
      difficulty: 'Easy',
      createdAt: new Date('2024-01-10'),
      fsrs: {
        ...createEmptyCard(),
        state: FsrsState.Review,
        due: futureDate,
      },
      paused: false,
      domain: 'leetcode.com',
    };

    expect(isDueByDate(card)).toBe(false);
  });

  it('should handle cards due at exactly midnight today', () => {
    const now = new Date();
    const midnightToday = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0);

    const card: Card = {
      id: 'test-id',
      slug: 'test-problem',
      name: 'Test Problem',
      leetcodeId: '1',
      difficulty: 'Easy',
      createdAt: new Date('2024-01-10'),
      fsrs: {
        ...createEmptyCard(),
        state: FsrsState.Learning,
        due: midnightToday,
      },
      paused: false,
      domain: 'leetcode.com',
    };

    expect(isDueByDate(card)).toBe(true);
  });

  it('should handle cards due at 23:59:59 today', () => {
    const now = new Date();
    const endOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);

    const card: Card = {
      id: 'test-id',
      slug: 'test-problem',
      name: 'Test Problem',
      leetcodeId: '1',
      difficulty: 'Easy',
      createdAt: new Date('2024-01-10'),
      fsrs: {
        ...createEmptyCard(),
        state: FsrsState.Review,
        due: endOfToday,
      },
      paused: false,
      domain: 'leetcode.com',
    };

    expect(isDueByDate(card)).toBe(true);
  });

  it('should correctly handle date comparison in local timezone', () => {
    // Test at different times of day to ensure date comparison works
    const testTimes = [
      new Date('2024-01-15T00:00:00'), // Midnight local
      new Date('2024-01-15T06:00:00'), // 6 AM local
      new Date('2024-01-15T12:00:00'), // Noon local
      new Date('2024-01-15T18:00:00'), // 6 PM local
      new Date('2024-01-15T23:59:59'), // End of day local
    ];

    testTimes.forEach((time) => {
      vi.setSystemTime(time);

      // Create a card due at any time today
      const cardDueToday: Card = {
        id: 'test-id',
        slug: 'test-problem',
        name: 'Test Problem',
        leetcodeId: '1',
        difficulty: 'Easy',
        createdAt: new Date('2024-01-10'),
        fsrs: {
          ...createEmptyCard(),
          state: FsrsState.Review,
          due: new Date('2024-01-15T10:00:00'), // 10 AM on the same day
        },
        paused: false,
        domain: 'leetcode.com',
      };

      expect(isDueByDate(cardDueToday)).toBe(true);
    });
  });

  it('should handle timezone edge cases correctly', () => {
    // Test that a card due today in local timezone is included
    // even if it might be tomorrow in UTC
    vi.setSystemTime(new Date('2024-01-15T23:00:00')); // 11 PM local time

    const now = new Date();
    const cardDueToday: Card = {
      id: 'test-id',
      slug: 'test-problem',
      name: 'Test Problem',
      leetcodeId: '1',
      difficulty: 'Easy',
      createdAt: new Date('2024-01-10'),
      fsrs: {
        ...createEmptyCard(),
        state: FsrsState.Review,
        // Due at noon today local time
        due: new Date(now.getFullYear(), now.getMonth(), now.getDate(), 12, 0, 0),
      },
      paused: false,
      domain: 'leetcode.com',
    };

    expect(isDueByDate(cardDueToday)).toBe(true);

    // Card due tomorrow should not be included
    const cardDueTomorrow: Card = {
      ...cardDueToday,
      fsrs: {
        ...cardDueToday.fsrs,
        due: new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1, 0, 0, 1),
      },
    };

    expect(isDueByDate(cardDueTomorrow)).toBe(false);
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
    await addCard({
      slug: 'problem1',
      name: 'Problem 1',
      leetcodeId: '1001',
      difficulty: 'Easy',
      domain: 'leetcode.com',
    });
    await addCard({
      slug: 'problem2',
      name: 'Problem 2',
      leetcodeId: '1002',
      difficulty: 'Medium',
      domain: 'leetcode.com',
    });
    await addCard({
      slug: 'problem3',
      name: 'Problem 3',
      leetcodeId: '1003',
      difficulty: 'Hard',
      domain: 'leetcode.com',
    });
    await addCard({
      slug: 'problem4',
      name: 'Problem 4',
      leetcodeId: '1004',
      difficulty: 'Easy',
      domain: 'leetcode.com',
    });
    await addCard({
      slug: 'problem5',
      name: 'Problem 5',
      leetcodeId: '1005',
      difficulty: 'Medium',
      domain: 'leetcode.com',
    });

    const queue = await getReviewQueue();

    // Should only get DEFAULT_MAX_NEW_CARDS_PER_DAY
    expect(queue).toHaveLength(DEFAULT_MAX_NEW_CARDS_PER_DAY);
    expect(queue.every((card) => card.fsrs.state === FsrsState.New)).toBe(true);
  });

  it('should return only review cards when they are due', async () => {
    // Create and rate cards to make them review cards
    await addCard({
      slug: 'problem1',
      name: 'Problem 1',
      leetcodeId: '1001',
      difficulty: 'Easy',
      domain: 'leetcode.com',
    });
    await addCard({
      slug: 'problem2',
      name: 'Problem 2',
      leetcodeId: '1002',
      difficulty: 'Medium',
      domain: 'leetcode.com',
    });

    // Rate them to move out of New state
    await rateCard({
      slug: 'problem1',
      name: 'Problem 1',
      rating: Rating.Good,
      leetcodeId: '1001',
      difficulty: 'Easy',
      domain: 'leetcode.com',
    });
    await rateCard({
      slug: 'problem2',
      name: 'Problem 2',
      rating: Rating.Good,
      leetcodeId: '1002',
      difficulty: 'Medium',
      domain: 'leetcode.com',
    });

    // Manually update their due dates to be in the past
    const cards = await storage.getItem<Record<string, StoredCard>>(STORAGE_KEYS.cards);
    const pastTime = new Date('2024-01-14T12:00:00Z').getTime();
    requireDefined(cards).problem1.fsrs.due = pastTime;
    requireDefined(cards).problem2.fsrs.due = pastTime;
    await storage.setItem(STORAGE_KEYS.cards, cards);

    const queue = await getReviewQueue();

    expect(queue).toHaveLength(2);
    expect(queue.every((card) => card.fsrs.state !== FsrsState.New)).toBe(true);
  });

  it('should interleave review and new cards', async () => {
    // Reset stats to ensure clean state
    await storage.setItem(STORAGE_KEYS.stats, {});

    // Create some new cards
    await addCard({ slug: 'new1', name: 'New 1', leetcodeId: '2001', difficulty: 'Easy', domain: 'leetcode.com' });
    await addCard({ slug: 'new2', name: 'New 2', leetcodeId: '2002', difficulty: 'Medium', domain: 'leetcode.com' });
    await addCard({ slug: 'new3', name: 'New 3', leetcodeId: '2003', difficulty: 'Hard', domain: 'leetcode.com' });
    await addCard({ slug: 'new4', name: 'New 4', leetcodeId: '2004', difficulty: 'Easy', domain: 'leetcode.com' }); // This won't be included (exceeds limit)

    // Create some review cards
    await addCard({
      slug: 'review1',
      name: 'Review 1',
      leetcodeId: '3001',
      difficulty: 'Medium',
      domain: 'leetcode.com',
    });
    await addCard({
      slug: 'review2',
      name: 'Review 2',
      leetcodeId: '3002',
      difficulty: 'Hard',
      domain: 'leetcode.com',
    });

    // Rate review cards to move them out of New state
    await rateCard({
      slug: 'review1',
      name: 'Review 1',
      rating: Rating.Good,
      leetcodeId: '3001',
      difficulty: 'Medium',
      domain: 'leetcode.com',
    });
    await rateCard({
      slug: 'review2',
      name: 'Review 2',
      rating: Rating.Good,
      leetcodeId: '3002',
      difficulty: 'Hard',
      domain: 'leetcode.com',
    });

    // Set their due dates to the past
    const cards = await storage.getItem<Record<string, StoredCard>>(STORAGE_KEYS.cards);
    const pastTime = new Date('2024-01-14T12:00:00Z').getTime();
    requireDefined(cards).review1.fsrs.due = pastTime;
    requireDefined(cards).review2.fsrs.due = pastTime;
    await storage.setItem(STORAGE_KEYS.cards, cards);

    const queue = await getReviewQueue();

    // Rating the cards created stats entries, so we need to account for that
    // We rated 2 cards as new (review1 and review2 were new when first rated)
    // So remaining new cards = DEFAULT_MAX_NEW_CARDS_PER_DAY - 2 = 1
    // Total = 2 review cards + 1 new card = 3
    expect(queue).toHaveLength(3);

    const newCards = queue.filter((card) => card.fsrs.state === FsrsState.New);
    const reviewCards = queue.filter((card) => card.fsrs.state !== FsrsState.New);

    expect(newCards).toHaveLength(1); // Only 1 new card left after rating 2
    expect(reviewCards).toHaveLength(2);
  });

  it('should not include future due cards', async () => {
    await addCard({
      slug: 'future1',
      name: 'Future 1',
      leetcodeId: '4001',
      difficulty: 'Easy',
      domain: 'leetcode.com',
    });
    await rateCard({
      slug: 'future1',
      name: 'Future 1',
      rating: Rating.Good,
      leetcodeId: '4001',
      difficulty: 'Easy',
      domain: 'leetcode.com',
    });

    // Set due date to future
    const cards = await storage.getItem<Record<string, StoredCard>>(STORAGE_KEYS.cards);
    const futureTime = new Date('2024-01-16T12:00:00Z').getTime();
    requireDefined(cards).future1.fsrs.due = futureTime;
    await storage.setItem(STORAGE_KEYS.cards, cards);

    const queue = await getReviewQueue();

    expect(queue).toHaveLength(0);
  });

  it('should include cards due today regardless of time', async () => {
    // Test that cards due at any time today are included
    await addCard({
      slug: 'morning',
      name: 'Morning Card',
      leetcodeId: '5001',
      difficulty: 'Easy',
      domain: 'leetcode.com',
    });
    await addCard({
      slug: 'evening',
      name: 'Evening Card',
      leetcodeId: '5002',
      difficulty: 'Medium',
      domain: 'leetcode.com',
    });
    await addCard({
      slug: 'midnight',
      name: 'Midnight Card',
      leetcodeId: '5003',
      difficulty: 'Hard',
      domain: 'leetcode.com',
    });

    // Rate them to move out of New state
    await rateCard({
      slug: 'morning',
      name: 'Morning Card',
      rating: Rating.Good,
      leetcodeId: '5001',
      difficulty: 'Easy',
      domain: 'leetcode.com',
    });
    await rateCard({
      slug: 'evening',
      name: 'Evening Card',
      rating: Rating.Good,
      leetcodeId: '5002',
      difficulty: 'Medium',
      domain: 'leetcode.com',
    });
    await rateCard({
      slug: 'midnight',
      name: 'Midnight Card',
      rating: Rating.Good,
      leetcodeId: '5003',
      difficulty: 'Hard',
      domain: 'leetcode.com',
    });

    // Set due times to various times today
    const cards = await storage.getItem<Record<string, StoredCard>>(STORAGE_KEYS.cards);
    requireDefined(cards).morning.fsrs.due = new Date('2024-01-15T06:00:00Z').getTime(); // 6 AM today
    requireDefined(cards).evening.fsrs.due = new Date('2024-01-15T20:00:00Z').getTime(); // 8 PM today
    requireDefined(cards).midnight.fsrs.due = new Date('2024-01-15T23:59:59Z').getTime(); // End of today
    await storage.setItem(STORAGE_KEYS.cards, cards);

    const queue = await getReviewQueue();

    // All three should be included even though they're due at different times today
    const reviewCards = queue.filter((card) => card.fsrs.state !== FsrsState.New);
    expect(reviewCards).toHaveLength(3);

    const slugs = reviewCards.map((card) => card.slug);
    expect(slugs).toContain('morning');
    expect(slugs).toContain('evening');
    expect(slugs).toContain('midnight');
  });

  it('should exclude cards due tomorrow even if due at 00:00:01', async () => {
    await addCard({
      slug: 'tomorrow',
      name: 'Tomorrow Card',
      leetcodeId: '5004',
      difficulty: 'Medium',
      domain: 'leetcode.com',
    });
    await rateCard({
      slug: 'tomorrow',
      name: 'Tomorrow Card',
      rating: Rating.Good,
      leetcodeId: '5004',
      difficulty: 'Medium',
      domain: 'leetcode.com',
    });

    // Set due to one second after midnight tomorrow in local timezone
    const now = new Date();
    const tomorrow = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1, 0, 0, 1);
    const cards = await storage.getItem<Record<string, StoredCard>>(STORAGE_KEYS.cards);
    requireDefined(cards).tomorrow.fsrs.due = tomorrow.getTime();
    await storage.setItem(STORAGE_KEYS.cards, cards);

    const queue = await getReviewQueue();

    // Should not include the card due tomorrow
    expect(queue).toHaveLength(0);
  });

  it('should handle mix of new, due, and future cards', async () => {
    // Reset stats to ensure clean state
    await storage.setItem(STORAGE_KEYS.stats, {});

    // Create new cards
    await addCard({ slug: 'new1', name: 'New 1', leetcodeId: '2001', difficulty: 'Easy', domain: 'leetcode.com' });
    await addCard({ slug: 'new2', name: 'New 2', leetcodeId: '2002', difficulty: 'Medium', domain: 'leetcode.com' });

    // Create due review cards
    await addCard({ slug: 'due1', name: 'Due 1', leetcodeId: '5001', difficulty: 'Medium', domain: 'leetcode.com' });
    await rateCard({
      slug: 'due1',
      name: 'Due 1',
      rating: Rating.Good,
      leetcodeId: '5001',
      difficulty: 'Medium',
      domain: 'leetcode.com',
    });

    // Create future review cards
    await addCard({
      slug: 'future1',
      name: 'Future 1',
      leetcodeId: '4001',
      difficulty: 'Easy',
      domain: 'leetcode.com',
    });
    await rateCard({
      slug: 'future1',
      name: 'Future 1',
      rating: Rating.Easy,
      leetcodeId: '4001',
      difficulty: 'Easy',
      domain: 'leetcode.com',
    });

    // Manually set due dates
    const cards = await storage.getItem<Record<string, StoredCard>>(STORAGE_KEYS.cards);
    const pastTime = new Date('2024-01-14T12:00:00Z').getTime();
    const futureTime = new Date('2024-01-16T12:00:00Z').getTime();
    requireDefined(cards).due1.fsrs.due = pastTime;
    requireDefined(cards).future1.fsrs.due = futureTime;
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

  it('should respect max new cards per day limit from settings', async () => {
    // Create many new cards
    for (let i = 1; i <= 10; i++) {
      await addCard({
        slug: `new${i}`,
        name: `New ${i}`,
        leetcodeId: `${6000 + i}`,
        difficulty: 'Medium',
        domain: 'leetcode.com',
      });
    }

    const queue = await getReviewQueue();

    // Should only include DEFAULT_MAX_NEW_CARDS_PER_DAY new cards
    expect(queue).toHaveLength(DEFAULT_MAX_NEW_CARDS_PER_DAY);
    expect(queue.every((card) => card.fsrs.state === FsrsState.New)).toBe(true);
  });

  it('should include all due review cards regardless of limit', async () => {
    // Create many review cards
    for (let i = 1; i <= 10; i++) {
      await addCard({
        slug: `review${i}`,
        name: `Review ${i}`,
        leetcodeId: `${7000 + i}`,
        difficulty: 'Medium',
        domain: 'leetcode.com',
      });
      await rateCard({
        slug: `review${i}`,
        name: `Review ${i}`,
        rating: Rating.Good,
        leetcodeId: `${7000 + i}`,
        difficulty: 'Medium',
        domain: 'leetcode.com',
      });
    }

    // Set all to be due
    const cards = await storage.getItem<Record<string, StoredCard>>(STORAGE_KEYS.cards);
    const pastTime = new Date('2024-01-14T12:00:00Z').getTime();
    for (let i = 1; i <= 10; i++) {
      requireDefined(cards)[`review${i}`].fsrs.due = pastTime;
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
      await addCard({
        slug: `new${i}`,
        name: `New ${i}`,
        leetcodeId: `${6000 + i}`,
        difficulty: 'Medium',
        domain: 'leetcode.com',
      });
    }

    const queue = await getReviewQueue();

    // Should only get (DEFAULT_MAX_NEW_CARDS_PER_DAY - 1) since 1 was already done
    expect(queue).toHaveLength(DEFAULT_MAX_NEW_CARDS_PER_DAY - 1);
    expect(queue.every((card) => card.fsrs.state === FsrsState.New)).toBe(true);
  });

  it('should return no new cards when daily limit already reached', async () => {
    // Create stats showing MAX_NEW_CARDS_PER_DAY already done
    await storage.setItem(
      STORAGE_KEYS.stats,
      createTestStats({
        newCards: DEFAULT_MAX_NEW_CARDS_PER_DAY,
        gradeBreakdown: {
          [Rating.Again]: 0,
          [Rating.Hard]: 0,
          [Rating.Good]: DEFAULT_MAX_NEW_CARDS_PER_DAY,
          [Rating.Easy]: 0,
        },
      })
    );

    // Create new cards
    for (let i = 1; i <= 5; i++) {
      await addCard({
        slug: `new${i}`,
        name: `New ${i}`,
        leetcodeId: `${8000 + i}`,
        difficulty: 'Easy',
        domain: 'leetcode.com',
      });
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
        newCards: DEFAULT_MAX_NEW_CARDS_PER_DAY,
        reviewedCards: 2,
        totalReviews: DEFAULT_MAX_NEW_CARDS_PER_DAY + 2,
        gradeBreakdown: {
          [Rating.Again]: 0,
          [Rating.Hard]: 2,
          [Rating.Good]: DEFAULT_MAX_NEW_CARDS_PER_DAY,
          [Rating.Easy]: 0,
        },
      })
    );

    // Create new cards (won't be included)
    await addCard({ slug: 'new1', name: 'New 1', leetcodeId: '2001', difficulty: 'Easy', domain: 'leetcode.com' });
    await addCard({ slug: 'new2', name: 'New 2', leetcodeId: '2002', difficulty: 'Medium', domain: 'leetcode.com' });

    // Create review cards (should be included)
    await addCard({
      slug: 'review1',
      name: 'Review 1',
      leetcodeId: '3001',
      difficulty: 'Medium',
      domain: 'leetcode.com',
    });
    await addCard({
      slug: 'review2',
      name: 'Review 2',
      leetcodeId: '3002',
      difficulty: 'Hard',
      domain: 'leetcode.com',
    });
    await rateCard({
      slug: 'review1',
      name: 'Review 1',
      rating: Rating.Good,
      leetcodeId: '3001',
      difficulty: 'Medium',
      domain: 'leetcode.com',
    });
    await rateCard({
      slug: 'review2',
      name: 'Review 2',
      rating: Rating.Good,
      leetcodeId: '3002',
      difficulty: 'Hard',
      domain: 'leetcode.com',
    });

    // Set review cards to be due
    const cards = await storage.getItem<Record<string, StoredCard>>(STORAGE_KEYS.cards);
    const pastTime = new Date('2024-01-14T12:00:00Z').getTime();
    requireDefined(cards).review1.fsrs.due = pastTime;
    requireDefined(cards).review2.fsrs.due = pastTime;
    await storage.setItem(STORAGE_KEYS.cards, cards);

    const queue = await getReviewQueue();

    // Should only have the 2 review cards
    expect(queue).toHaveLength(2);
    expect(queue.every((card) => card.fsrs.state !== FsrsState.New)).toBe(true);
  });

  it('should handle partial new card limit correctly', async () => {
    // Set DEFAULT_MAX_NEW_CARDS_PER_DAY = 3, already did 2
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
      await addCard({
        slug: `new${i}`,
        name: `New ${i}`,
        leetcodeId: `${6000 + i}`,
        difficulty: 'Medium',
        domain: 'leetcode.com',
      });
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
      await addCard({
        slug: `new${i}`,
        name: `New ${i}`,
        leetcodeId: `${8000 + i}`,
        difficulty: 'Easy',
        domain: 'leetcode.com',
      });
    }

    const queue = await getReviewQueue();

    // Should get full DEFAULT_MAX_NEW_CARDS_PER_DAY when no stats exist
    expect(queue).toHaveLength(DEFAULT_MAX_NEW_CARDS_PER_DAY);
    expect(queue.every((card) => card.fsrs.state === FsrsState.New)).toBe(true);
  });

  it('should respect custom max new cards per day setting', async () => {
    // Set custom max new cards per day
    const { getMaxNewCardsPerDay } = await import('../settings');
    vi.mocked(getMaxNewCardsPerDay).mockResolvedValue(5);

    // Create new cards
    for (let i = 1; i <= 10; i++) {
      await addCard({
        slug: `new${i}`,
        name: `New ${i}`,
        leetcodeId: `${9000 + i}`,
        difficulty: 'Easy',
        domain: 'leetcode.com',
      });
    }

    const queue = await getReviewQueue();

    // Should get 5 new cards based on custom setting
    expect(queue).toHaveLength(5);
    expect(queue.every((card) => card.fsrs.state === FsrsState.New)).toBe(true);
  });

  it('should sort cards by due date then slug for stable ordering', async () => {
    // Create cards with specific due dates
    await addCard({ slug: 'card-c', name: 'Card C', leetcodeId: '1001', difficulty: 'Easy', domain: 'leetcode.com' });
    await addCard({ slug: 'card-a', name: 'Card A', leetcodeId: '1002', difficulty: 'Medium', domain: 'leetcode.com' });
    await addCard({ slug: 'card-b', name: 'Card B', leetcodeId: '1003', difficulty: 'Hard', domain: 'leetcode.com' });

    // Set same due date for all cards
    const cards = await storage.getItem<Record<string, StoredCard>>(STORAGE_KEYS.cards);
    const sameTime = new Date('2024-01-15T10:00:00').getTime();
    requireDefined(cards)['card-c'].fsrs.due = sameTime;
    requireDefined(cards)['card-a'].fsrs.due = sameTime;
    requireDefined(cards)['card-b'].fsrs.due = sameTime;
    await storage.setItem(STORAGE_KEYS.cards, cards);

    const queue = await getReviewQueue();

    // Should be sorted by slug when due dates are the same
    expect(queue[0].slug).toBe('card-a');
    expect(queue[1].slug).toBe('card-b');
    expect(queue[2].slug).toBe('card-c');
  });

  it('should maintain stable order across multiple calls', async () => {
    // Create multiple cards
    for (let i = 1; i <= 5; i++) {
      await addCard({
        slug: `card-${i}`,
        name: `Card ${i}`,
        leetcodeId: `${1000 + i}`,
        difficulty: 'Medium',
        domain: 'leetcode.com',
      });
    }

    // Get queue multiple times
    const queue1 = await getReviewQueue();
    const queue2 = await getReviewQueue();
    const queue3 = await getReviewQueue();

    // All queues should be identical
    expect(queue1.map((c) => c.slug)).toEqual(queue2.map((c) => c.slug));
    expect(queue2.map((c) => c.slug)).toEqual(queue3.map((c) => c.slug));
    expect(queue1.length).toBe(3); // Limited by max new cards per day
  });

  it('should place cards rated "Again" at the back of the queue', async () => {
    // Create cards
    await addCard({
      slug: 'first-card',
      name: 'First Card',
      leetcodeId: '1001',
      difficulty: 'Easy',
      domain: 'leetcode.com',
    });
    await addCard({
      slug: 'second-card',
      name: 'Second Card',
      leetcodeId: '1002',
      difficulty: 'Medium',
      domain: 'leetcode.com',
    });
    await addCard({
      slug: 'third-card',
      name: 'Third Card',
      leetcodeId: '1003',
      difficulty: 'Hard',
      domain: 'leetcode.com',
    });

    // Rate first card as "Again" - it should get a due date later today
    await rateCard({
      slug: 'first-card',
      name: 'First Card',
      rating: Rating.Again,
      leetcodeId: '1001',
      difficulty: 'Easy',
      domain: 'leetcode.com',
    });

    const queue = await getReviewQueue();

    // First card should now be at the end (due later today)
    const slugs = queue.map((c) => c.slug);
    expect(slugs[0]).toBe('second-card');
    expect(slugs[1]).toBe('third-card');
    expect(slugs[2]).toBe('first-card');
  });

  it('should select the same new cards consistently when limit applies', async () => {
    // Create more new cards than the daily limit
    const cardSlugs = ['alpha', 'bravo', 'charlie', 'delta', 'echo', 'foxtrot'];
    for (let i = 0; i < cardSlugs.length; i++) {
      await addCard({
        slug: cardSlugs[i],
        name: `Card ${cardSlugs[i]}`,
        leetcodeId: `${2000 + i}`,
        difficulty: 'Medium',
        domain: 'leetcode.com',
      });
    }

    // Set all cards to have the same due date for predictable ordering
    const cards = await storage.getItem<Record<string, StoredCard>>(STORAGE_KEYS.cards);
    const sameTime = new Date('2024-01-15T10:00:00').getTime();
    for (const slug of cardSlugs) {
      requireDefined(cards)[slug].fsrs.due = sameTime;
    }
    await storage.setItem(STORAGE_KEYS.cards, cards);

    // Get queue multiple times
    const queue1 = await getReviewQueue();
    const queue2 = await getReviewQueue();

    // Should always select the same new cards (first 3 alphabetically)
    expect(queue1.map((c) => c.slug)).toEqual(['alpha', 'bravo', 'charlie']);
    expect(queue2.map((c) => c.slug)).toEqual(['alpha', 'bravo', 'charlie']);
  });

  it('should maintain order when mixing review and new cards', async () => {
    // Create new cards with early due dates
    await addCard({
      slug: 'new-early',
      name: 'New Early',
      leetcodeId: '1001',
      difficulty: 'Easy',
      domain: 'leetcode.com',
    });
    await addCard({
      slug: 'new-late',
      name: 'New Late',
      leetcodeId: '1002',
      difficulty: 'Medium',
      domain: 'leetcode.com',
    });

    // Create review cards
    await addCard({
      slug: 'review-middle',
      name: 'Review Middle',
      leetcodeId: '2001',
      difficulty: 'Hard',
      domain: 'leetcode.com',
    });
    await rateCard({
      slug: 'review-middle',
      name: 'Review Middle',
      rating: Rating.Good,
      leetcodeId: '2001',
      difficulty: 'Hard',
      domain: 'leetcode.com',
    });

    // Set specific due dates
    const cards = await storage.getItem<Record<string, StoredCard>>(STORAGE_KEYS.cards);
    requireDefined(cards)['new-early'].fsrs.due = new Date('2024-01-15T08:00:00').getTime();
    requireDefined(cards)['review-middle'].fsrs.due = new Date('2024-01-15T10:00:00').getTime();
    requireDefined(cards)['new-late'].fsrs.due = new Date('2024-01-15T12:00:00').getTime();
    await storage.setItem(STORAGE_KEYS.cards, cards);

    const queue = await getReviewQueue();

    // Should be ordered by due date regardless of card type
    expect(queue[0].slug).toBe('new-early');
    expect(queue[1].slug).toBe('review-middle');
    expect(queue[2].slug).toBe('new-late');
  });

  it('should handle cards rated "Hard" moving to later in the day', async () => {
    // Set time to morning
    vi.setSystemTime(new Date('2024-01-15T09:00:00'));

    // Create cards
    await addCard({ slug: 'card-1', name: 'Card 1', leetcodeId: '1001', difficulty: 'Easy', domain: 'leetcode.com' });
    await addCard({ slug: 'card-2', name: 'Card 2', leetcodeId: '1002', difficulty: 'Medium', domain: 'leetcode.com' });
    await addCard({ slug: 'card-3', name: 'Card 3', leetcodeId: '1003', difficulty: 'Hard', domain: 'leetcode.com' });

    // Get initial queue
    const initialQueue = await getReviewQueue();
    expect(initialQueue[0].slug).toBe('card-1');

    // Rate first card as "Hard" - should move to later today
    await rateCard({
      slug: 'card-1',
      name: 'Card 1',
      rating: Rating.Hard,
      leetcodeId: '1001',
      difficulty: 'Easy',
      domain: 'leetcode.com',
    });

    // Get queue again
    const updatedQueue = await getReviewQueue();

    // Card-1 should now be at the end (due later)
    const slugs = updatedQueue.map((c) => c.slug);
    expect(slugs[0]).toBe('card-2');
    expect(slugs[1]).toBe('card-3');
    expect(slugs[2]).toBe('card-1'); // Moved to end
  });

  it('should handle dynamic changes to max new cards setting', async () => {
    const { getMaxNewCardsPerDay } = await import('../settings');

    // Create many new cards
    for (let i = 1; i <= 10; i++) {
      await addCard({
        slug: `card-${i}`,
        name: `Card ${i}`,
        leetcodeId: `${3000 + i}`,
        difficulty: 'Medium',
        domain: 'leetcode.com',
      });
    }

    // Start with default (3)
    vi.mocked(getMaxNewCardsPerDay).mockResolvedValue(3);
    let queue = await getReviewQueue();
    expect(queue.length).toBe(3);

    // Increase to 5
    vi.mocked(getMaxNewCardsPerDay).mockResolvedValue(5);
    queue = await getReviewQueue();
    expect(queue.length).toBe(5);

    // Decrease to 2
    vi.mocked(getMaxNewCardsPerDay).mockResolvedValue(2);
    queue = await getReviewQueue();
    expect(queue.length).toBe(2);

    // Cards selected should be consistent (first N alphabetically)
    expect(queue[0].slug).toBe('card-1');
    expect(queue[1].slug).toBe('card-10'); // '10' comes after '1' in string sort
  });

  it('should properly sort by due date timestamps', async () => {
    // Create cards and rate them to get different due times
    await addCard({ slug: 'early', name: 'Early', leetcodeId: '1001', difficulty: 'Easy', domain: 'leetcode.com' });
    await addCard({ slug: 'middle', name: 'Middle', leetcodeId: '1002', difficulty: 'Medium', domain: 'leetcode.com' });
    await addCard({ slug: 'late', name: 'Late', leetcodeId: '1003', difficulty: 'Hard', domain: 'leetcode.com' });

    // Set specific due times
    const cards = await storage.getItem<Record<string, StoredCard>>(STORAGE_KEYS.cards);
    requireDefined(cards).early.fsrs.due = new Date('2024-01-15T06:00:00').getTime();
    requireDefined(cards).middle.fsrs.due = new Date('2024-01-15T12:00:00').getTime();
    requireDefined(cards).late.fsrs.due = new Date('2024-01-15T18:00:00').getTime();
    await storage.setItem(STORAGE_KEYS.cards, cards);

    const queue = await getReviewQueue();

    // Should be in chronological order
    expect(queue[0].slug).toBe('early');
    expect(queue[1].slug).toBe('middle');
    expect(queue[2].slug).toBe('late');
  });

  it('should handle cards with millisecond-precision due times', async () => {
    await addCard({ slug: 'card-a', name: 'Card A', leetcodeId: '1001', difficulty: 'Easy', domain: 'leetcode.com' });
    await addCard({ slug: 'card-b', name: 'Card B', leetcodeId: '1002', difficulty: 'Medium', domain: 'leetcode.com' });
    await addCard({ slug: 'card-c', name: 'Card C', leetcodeId: '1003', difficulty: 'Hard', domain: 'leetcode.com' });

    // Set due times with millisecond differences
    const cards = await storage.getItem<Record<string, StoredCard>>(STORAGE_KEYS.cards);
    const baseTime = new Date('2024-01-15T10:00:00').getTime();
    requireDefined(cards)['card-a'].fsrs.due = baseTime + 100; // 100ms later
    requireDefined(cards)['card-b'].fsrs.due = baseTime + 50; // 50ms later
    requireDefined(cards)['card-c'].fsrs.due = baseTime + 150; // 150ms later
    await storage.setItem(STORAGE_KEYS.cards, cards);

    const queue = await getReviewQueue();

    // Should be sorted by exact millisecond times
    expect(queue[0].slug).toBe('card-b'); // +50ms
    expect(queue[1].slug).toBe('card-a'); // +100ms
    expect(queue[2].slug).toBe('card-c'); // +150ms
  });

  it('should handle empty queue gracefully', async () => {
    const queue = await getReviewQueue();
    expect(queue).toEqual([]);
  });

  it('should handle queue with only paused cards', async () => {
    await addCard({
      slug: 'paused-1',
      name: 'Paused 1',
      leetcodeId: '1001',
      difficulty: 'Easy',
      domain: 'leetcode.com',
    });
    await addCard({
      slug: 'paused-2',
      name: 'Paused 2',
      leetcodeId: '1002',
      difficulty: 'Medium',
      domain: 'leetcode.com',
    });

    await setPauseStatus('paused-1', true);
    await setPauseStatus('paused-2', true);

    const queue = await getReviewQueue();
    expect(queue).toEqual([]);
  });

  it('should handle queue with only future cards', async () => {
    await addCard({
      slug: 'future-1',
      name: 'Future 1',
      leetcodeId: '1001',
      difficulty: 'Easy',
      domain: 'leetcode.com',
    });
    await addCard({
      slug: 'future-2',
      name: 'Future 2',
      leetcodeId: '1002',
      difficulty: 'Medium',
      domain: 'leetcode.com',
    });

    // Set due dates to tomorrow
    const cards = await storage.getItem<Record<string, StoredCard>>(STORAGE_KEYS.cards);
    const tomorrow = new Date('2024-01-16T10:00:00').getTime();
    requireDefined(cards)['future-1'].fsrs.due = tomorrow;
    requireDefined(cards)['future-2'].fsrs.due = tomorrow;
    await storage.setItem(STORAGE_KEYS.cards, cards);

    const queue = await getReviewQueue();
    expect(queue).toEqual([]);
  });

  it('should exclude paused cards from review queue', async () => {
    // Set up time
    const today = new Date('2024-01-15T10:00:00');
    vi.setSystemTime(today);

    // Create new cards
    await addCard({ slug: 'new1', name: 'New 1', leetcodeId: '1001', difficulty: 'Easy', domain: 'leetcode.com' });
    await addCard({ slug: 'new2', name: 'New 2', leetcodeId: '1002', difficulty: 'Medium', domain: 'leetcode.com' });
    await addCard({ slug: 'new3', name: 'New 3', leetcodeId: '1003', difficulty: 'Hard', domain: 'leetcode.com' });
    await addCard({ slug: 'new4', name: 'New 4', leetcodeId: '1004', difficulty: 'Easy', domain: 'leetcode.com' });

    // Create review cards (rate them to make them due)
    await rateCard({
      slug: 'review1',
      name: 'Review 1',
      rating: Rating.Again,
      leetcodeId: '2001',
      difficulty: 'Easy',
      domain: 'leetcode.com',
    });
    await rateCard({
      slug: 'review2',
      name: 'Review 2',
      rating: Rating.Hard,
      leetcodeId: '2002',
      difficulty: 'Medium',
      domain: 'leetcode.com',
    });

    // Pause some cards
    await setPauseStatus('new2', true); // Pause a new card
    await setPauseStatus('new4', true); // Pause another new card
    await setPauseStatus('review1', true); // Pause a review card

    const queue = await getReviewQueue();

    // Should exclude all paused cards
    expect(queue).not.toContainEqual(expect.objectContaining({ slug: 'new2' }));
    expect(queue).not.toContainEqual(expect.objectContaining({ slug: 'new4' }));
    expect(queue).not.toContainEqual(expect.objectContaining({ slug: 'review1' }));

    // Should include non-paused cards
    expect(queue).toContainEqual(expect.objectContaining({ slug: 'new1' }));
    expect(queue).toContainEqual(expect.objectContaining({ slug: 'review2' }));

    // With 2 new cards already rated (review1 and review2), we have 1 slot left for new cards
    // But new2 and new4 are paused, so only new1 and new3 are available
    // So we should get: new1 (or new3) + review2 = 2 total
    expect(queue).toHaveLength(2);
  });

  it('should handle all cards being paused', async () => {
    // Create and pause all cards
    await addCard({
      slug: 'paused1',
      name: 'Paused 1',
      leetcodeId: '3001',
      difficulty: 'Easy',
      domain: 'leetcode.com',
    });
    await addCard({
      slug: 'paused2',
      name: 'Paused 2',
      leetcodeId: '3002',
      difficulty: 'Medium',
      domain: 'leetcode.com',
    });
    await setPauseStatus('paused1', true);
    await setPauseStatus('paused2', true);

    const queue = await getReviewQueue();

    // Should return empty queue when all cards are paused
    expect(queue).toEqual([]);
  });
});
