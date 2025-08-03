import { describe, it, expect, vi, beforeEach } from 'vitest';
import { fakeBrowser } from 'wxt/testing';
import { createCard, addCard } from './cards';
import { STORAGE_KEYS } from './storage-keys';

describe('createCard', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should generate a unique ID using crypto.randomUUID', () => {
    const card1 = createCard('two-sum', 'Two Sum');
    const card2 = createCard('two-sum', 'Two Sum');

    expect(card1.id).toBeTruthy();
    expect(card2.id).toBeTruthy();
    expect(card1.id).not.toBe(card2.id);
    expect(card1.id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i);
  });

  it('should set createdAt to current date', () => {
    const beforeTime = new Date();
    const card = createCard('two-sum', 'Two Sum');
    const afterTime = new Date();

    expect(card.createdAt).toBeInstanceOf(Date);
    expect(card.createdAt.getTime()).toBeGreaterThanOrEqual(beforeTime.getTime());
    expect(card.createdAt.getTime()).toBeLessThanOrEqual(afterTime.getTime());
  });

  it('should return a complete Card object with all required properties', () => {
    const card = createCard('two-sum', 'Two Sum');

    expect(card).toHaveProperty('id');
    expect(card).toHaveProperty('slug');
    expect(card).toHaveProperty('name');
    expect(card).toHaveProperty('createdAt');
    expect(typeof card.id).toBe('string');
    expect(typeof card.slug).toBe('string');
    expect(typeof card.name).toBe('string');
    expect(card.createdAt).toBeInstanceOf(Date);
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

    // Verify the card was actually stored
    const storage = await browser.storage.local.get(STORAGE_KEYS.cards);
    const cardsStorage = storage[STORAGE_KEYS.cards];

    expect(cardsStorage).toBeDefined();
    expect(cardsStorage.cards[card.id]).toBeDefined();
    expect(cardsStorage.slugToCardId['two-sum']).toBe(card.id);
    expect(cardsStorage.cards[card.id].slug).toBe('two-sum');
    expect(cardsStorage.cards[card.id].name).toBe('Two Sum');
  });

  it('should return existing card when adding same slug (idempotent)', async () => {
    // Add card first time
    const firstCard = await addCard('valid-parentheses', 'Valid Parentheses');
    const firstId = firstCard.id;
    const firstCreatedAt = firstCard.createdAt;

    // Add same card again
    const secondCard = await addCard('valid-parentheses', 'Valid Parentheses');

    // Should return the same card
    expect(secondCard.id).toBe(firstId);
    expect(secondCard.createdAt.getTime()).toBe(firstCreatedAt.getTime());
    expect(secondCard.slug).toBe('valid-parentheses');
    expect(secondCard.name).toBe('Valid Parentheses');

    // Verify only one card exists in storage
    const storage = await browser.storage.local.get(STORAGE_KEYS.cards);
    const cardsStorage = storage[STORAGE_KEYS.cards];

    expect(Object.keys(cardsStorage.cards).length).toBe(1);
    expect(Object.keys(cardsStorage.slugToCardId).length).toBe(1);
  });

  it('should store multiple different cards correctly', async () => {
    // Add multiple cards
    const card1 = await addCard('two-sum', 'Two Sum');
    const card2 = await addCard('valid-parentheses', 'Valid Parentheses');
    const card3 = await addCard('merge-two-sorted-lists', 'Merge Two Sorted Lists');

    // All cards should have different IDs
    expect(card1.id).not.toBe(card2.id);
    expect(card2.id).not.toBe(card3.id);
    expect(card1.id).not.toBe(card3.id);

    // Verify all cards are stored
    const storage = await browser.storage.local.get(STORAGE_KEYS.cards);
    const cardsStorage = storage[STORAGE_KEYS.cards];

    expect(Object.keys(cardsStorage.cards).length).toBe(3);
    expect(Object.keys(cardsStorage.slugToCardId).length).toBe(3);

    // Verify slug mappings
    expect(cardsStorage.slugToCardId['two-sum']).toBe(card1.id);
    expect(cardsStorage.slugToCardId['valid-parentheses']).toBe(card2.id);
    expect(cardsStorage.slugToCardId['merge-two-sorted-lists']).toBe(card3.id);
  });
});
