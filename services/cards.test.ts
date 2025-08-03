import { describe, it, expect, beforeEach } from 'vitest';
import { fakeBrowser } from 'wxt/testing';
import { storage } from 'wxt/utils/storage';
import { addCard, getAllCards, removeCard, serializeCard, deserializeCard, type Card, type StoredCard } from './cards';
import { STORAGE_KEYS } from './storage-keys';
import { createEmptyCard } from 'ts-fsrs';

describe('Card serialization', () => {
  describe('serializeCard', () => {
    it('should convert Date to timestamp', () => {
      const testDate = new Date('2024-01-15T10:30:00Z');
      const card: Card = {
        id: 'test-id-123',
        slug: 'two-sum',
        name: 'Two Sum',
        createdAt: testDate,
        fsrs: createEmptyCard(),
      };

      const serialized = serializeCard(card);

      expect(serialized.id).toBe('test-id-123');
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
        id: 'test-id-123',
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
        id: 'test-id-456',
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

      expect(deserialized.id).toBe('test-id-456');
      expect(deserialized.slug).toBe('merge-intervals');
      expect(deserialized.name).toBe('Merge Intervals');
      expect(deserialized.createdAt).toBeInstanceOf(Date);
      expect(deserialized.createdAt.getTime()).toBe(timestamp);
    });
  });

  describe('serializeCard and deserializeCard roundtrip', () => {
    it('should maintain data integrity through serialization and deserialization', () => {
      const originalCard: Card = {
        id: crypto.randomUUID(),
        slug: 'two-pointers',
        name: 'Two Pointers',
        createdAt: new Date(),
        fsrs: createEmptyCard(),
      };

      const serialized = serializeCard(originalCard);
      const deserialized = deserializeCard(serialized);

      expect(deserialized.id).toBe(originalCard.id);
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
    expect(card.id).toBeDefined();
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
    const slugToCardId = await storage.getItem<Record<string, string>>(STORAGE_KEYS.slugToCardId);

    expect(cards).toBeDefined();
    expect(cards![card.id]).toBeDefined();
    expect(slugToCardId!['two-sum']).toBe(card.id);
    expect(cards![card.id].slug).toBe('two-sum');
    expect(cards![card.id].name).toBe('Two Sum');

    // Verify FSRS data is stored properly
    expect(cards![card.id].fsrs).toBeDefined();
    expect(typeof cards![card.id].fsrs.due).toBe('number');
  });

  it('should return existing card when adding same slug (idempotent)', async () => {
    // Add card first time
    const firstCard = await addCard('valid-parentheses', 'Valid Parentheses');
    const firstId = firstCard.id;
    const firstCreatedAt = firstCard.createdAt;

    // Add same card again
    const secondCard = await addCard('valid-parentheses', 'A different name');

    // Should return the same card
    expect(secondCard.id).toBe(firstId);
    expect(secondCard.createdAt.getTime()).toBe(firstCreatedAt.getTime());
    expect(secondCard.slug).toBe('valid-parentheses');
    expect(secondCard.name).toBe('Valid Parentheses');

    // Verify only one card exists in storage
    const cards = await storage.getItem<Record<string, StoredCard>>(STORAGE_KEYS.cards);
    const slugToCardId = await storage.getItem<Record<string, string>>(STORAGE_KEYS.slugToCardId);

    expect(Object.keys(cards || {}).length).toBe(1);
    expect(Object.keys(slugToCardId || {}).length).toBe(1);
  });

  it('should store multiple different cards correctly', async () => {
    // Add multiple cards
    const card1 = await addCard('two-sum', 'Two Sum');
    const card2 = await addCard('valid-parentheses', 'Valid Parentheses');
    const card3 = await addCard('merge-two-sorted-lists', 'Merge Two Sorted Lists');

    // Verify all cards are stored
    const cards = await storage.getItem<Record<string, StoredCard>>(STORAGE_KEYS.cards);
    const slugToCardId = await storage.getItem<Record<string, string>>(STORAGE_KEYS.slugToCardId);

    expect(Object.keys(cards || {}).length).toBe(3);
    expect(Object.keys(slugToCardId || {}).length).toBe(3);

    // Verify slug mappings
    expect(slugToCardId!['two-sum']).toBe(card1.id);
    expect(slugToCardId!['valid-parentheses']).toBe(card2.id);
    expect(slugToCardId!['merge-two-sorted-lists']).toBe(card3.id);
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
    const storedCard = cards![card.id];

    expect(typeof storedCard.createdAt).toBe('number');
    expect(storedCard.id).toBe(card.id);
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
    const card1 = await addCard('two-sum', 'Two Sum');
    const card2 = await addCard('valid-parentheses', 'Valid Parentheses');
    const card3 = await addCard('merge-intervals', 'Merge Intervals');

    // Get all cards
    const allCards = await getAllCards();

    expect(allCards).toHaveLength(3);

    // Check that all cards are present
    const cardIds = allCards.map((c) => c.id);
    expect(cardIds).toContain(card1.id);
    expect(cardIds).toContain(card2.id);
    expect(cardIds).toContain(card3.id);

    // Check that cards have correct data
    const foundCard1 = allCards.find((c) => c.id === card1.id);
    expect(foundCard1?.slug).toBe('two-sum');
    expect(foundCard1?.name).toBe('Two Sum');

    const foundCard2 = allCards.find((c) => c.id === card2.id);
    expect(foundCard2?.slug).toBe('valid-parentheses');
    expect(foundCard2?.name).toBe('Valid Parentheses');

    const foundCard3 = allCards.find((c) => c.id === card3.id);
    expect(foundCard3?.slug).toBe('merge-intervals');
    expect(foundCard3?.name).toBe('Merge Intervals');
  });

  it('should properly deserialize stored cards', async () => {
    const testDate = new Date('2024-01-15T10:30:00Z');

    // Manually add a serialized card to storage
    const emptyFsrs = createEmptyCard();
    const storedCard: StoredCard = {
      id: 'test-id-123',
      slug: 'test-problem',
      name: 'Test Problem',
      createdAt: testDate.getTime(),
      fsrs: {
        ...emptyFsrs,
        due: emptyFsrs.due.getTime(),
        last_review: emptyFsrs.last_review?.getTime(),
      },
    };

    await storage.setItem(STORAGE_KEYS.cards, { 'test-id-123': storedCard });

    // Get all cards
    const allCards = await getAllCards();

    expect(allCards).toHaveLength(1);
    expect(allCards[0].id).toBe('test-id-123');
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
    const card = await addCard('two-sum', 'Two Sum');

    // Verify it exists
    let cards = await storage.getItem<Record<string, StoredCard>>(STORAGE_KEYS.cards);
    let slugToCardId = await storage.getItem<Record<string, string>>(STORAGE_KEYS.slugToCardId);
    expect(cards![card.id]).toBeDefined();
    expect(slugToCardId!['two-sum']).toBe(card.id);

    // Remove the card
    await removeCard('two-sum');

    // Verify it's removed
    cards = await storage.getItem<Record<string, StoredCard>>(STORAGE_KEYS.cards);
    slugToCardId = await storage.getItem<Record<string, string>>(STORAGE_KEYS.slugToCardId);
    expect(cards![card.id]).toBeUndefined();
    expect(slugToCardId!['two-sum']).toBeUndefined();
  });

  it('should handle removing non-existent card gracefully', async () => {
    // Try to remove a card that doesn't exist
    await expect(removeCard('non-existent-slug')).resolves.toBeUndefined();

    // Verify storage is still empty/unchanged
    const cards = await storage.getItem<Record<string, StoredCard>>(STORAGE_KEYS.cards);
    const slugToCardId = await storage.getItem<Record<string, string>>(STORAGE_KEYS.slugToCardId);
    expect(cards || {}).toEqual({});
    expect(slugToCardId || {}).toEqual({});
  });

  it('should only remove the specified card when multiple cards exist', async () => {
    // Add multiple cards
    const card1 = await addCard('two-sum', 'Two Sum');
    const card2 = await addCard('valid-parentheses', 'Valid Parentheses');
    const card3 = await addCard('merge-intervals', 'Merge Intervals');

    // Remove the middle card
    await removeCard('valid-parentheses');

    // Verify only the specified card is removed
    const cards = await storage.getItem<Record<string, StoredCard>>(STORAGE_KEYS.cards);
    const slugToCardId = await storage.getItem<Record<string, string>>(STORAGE_KEYS.slugToCardId);

    expect(Object.keys(cards || {}).length).toBe(2);
    expect(Object.keys(slugToCardId || {}).length).toBe(2);

    // Card 1 should still exist
    expect(cards![card1.id]).toBeDefined();
    expect(slugToCardId!['two-sum']).toBe(card1.id);

    // Card 2 should be removed
    expect(cards![card2.id]).toBeUndefined();
    expect(slugToCardId!['valid-parentheses']).toBeUndefined();

    // Card 3 should still exist
    expect(cards![card3.id]).toBeDefined();
    expect(slugToCardId!['merge-intervals']).toBe(card3.id);
  });

  it('should handle orphaned slug mapping (slug exists but card does not)', async () => {
    // Manually create an orphaned slug mapping
    await storage.setItem(STORAGE_KEYS.slugToCardId, { 'orphaned-slug': 'non-existent-id' });
    await storage.setItem(STORAGE_KEYS.cards, {});

    // Remove should clean up the orphaned mapping
    await removeCard('orphaned-slug');

    const slugToCardId = await storage.getItem<Record<string, string>>(STORAGE_KEYS.slugToCardId);
    expect(slugToCardId!['orphaned-slug']).toBeUndefined();
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
