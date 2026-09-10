import { State as FsrsState, Rating } from 'ts-fsrs';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fakeBrowser } from 'wxt/testing/fake-browser';
import { storage } from 'wxt/utils/storage';
import type { Card } from '@/domain/cards';
import type { DailyStats } from '@/domain/statistics';
import * as notesModule from '@/infrastructure/storage/notes';
import { STORAGE_KEYS } from '@/infrastructure/storage/storage-keys';
import { requireDefined } from '@/test/utils/assertions';
import { buildProblem, createMockCard } from '@/test/utils/card-mocks';
import { buildSettings } from '@/test/utils/settings-mocks';
import { addCard, delayCard, getAllCards, getReviewQueue, rateCard, removeCard, setPauseStatus } from '../cards';

const { mockGetSettings } = vi.hoisted(() => ({ mockGetSettings: vi.fn() }));

// Mock the notes module
vi.mock('@/infrastructure/storage/notes', () => ({
  deleteNote: vi.fn(),
}));

// Mock the settings module
vi.mock('../settings', () => ({
  getSettings: mockGetSettings,
}));

beforeEach(() => {
  mockGetSettings.mockResolvedValue(buildSettings());
});

describe('card mutations', () => {
  beforeEach(() => {
    fakeBrowser.reset();
  });

  it.each(['add', 'rate new', 'rate existing', 'delay', 'pause', 'resume', 'remove'])(
    '%s retains other supported cards and their learning data',
    async (operation) => {
      const others = [
        createMockCard(FsrsState.Review, { slug: 'reviewed', domain: 'leetcode.cn', paused: true }),
        createMockCard(FsrsState.Relearning, { slug: 'relearning' }),
      ];
      const problem = buildProblem();
      const target = createMockCard(FsrsState.Review, { ...problem, paused: operation === 'resume' });
      const initial = operation === 'add' || operation === 'rate new' ? others : [...others, target];
      await storage.setItem(STORAGE_KEYS.cards, Object.fromEntries(initial.map((card) => [card.slug, card])));

      switch (operation) {
        case 'add':
          await addCard(problem);
          break;
        case 'rate new':
        case 'rate existing':
          await rateCard({ ...problem, rating: Rating.Good });
          break;
        case 'delay':
          await delayCard(problem.slug, 3);
          break;
        case 'pause':
        case 'resume':
          await setPauseStatus(problem.slug, operation === 'pause');
          break;
        case 'remove':
          await removeCard(problem.slug);
          break;
      }

      const reloaded = await getAllCards();
      expect(reloaded.filter((card) => card.slug !== problem.slug)).toEqual(others);
      expect(reloaded).toHaveLength(operation === 'remove' ? 2 : 3);
      if (operation === 'remove') {
        expect(notesModule.deleteNote).toHaveBeenCalledExactlyOnceWith(target.id);
      } else {
        expect(notesModule.deleteNote).not.toHaveBeenCalled();
      }
    }
  );
});

describe('addCard', () => {
  beforeEach(() => {
    // Reset the fake browser state before each test
    fakeBrowser.reset();
  });

  it('round-trips a new card with its creation time and numeric schedule', async () => {
    const problem = buildProblem();
    const before = Date.now();
    const card = await addCard(problem);
    const after = Date.now();

    expect(card).toMatchObject({
      ...problem,
      id: expect.stringMatching(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i),
      paused: false,
      fsrs: { state: FsrsState.New, stability: 0, difficulty: 0, reps: 0, lapses: 0 },
    });
    expect(card.createdAt).toBeGreaterThanOrEqual(before);
    expect(card.createdAt).toBeLessThanOrEqual(after);
    expect(card.fsrs.due).toBe(card.createdAt);
    expect(card.fsrs.last_review).toBeUndefined();
    expect(await storage.getItem(STORAGE_KEYS.cards)).toEqual({ [problem.slug]: card });
    expect(await getAllCards()).toEqual([card]);
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
    expect(secondCard.createdAt).toBe(firstCreatedAt);
    expect(secondCard.name).toBe('Valid Parentheses');
    expect(secondCard.difficulty).toBe('Medium');
    expect(secondCard.domain).toBe('leetcode.com');

    // Verify only one card exists in storage
    const cards = await storage.getItem<Record<string, Card>>(STORAGE_KEYS.cards);

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
    const cards = await storage.getItem<Record<string, Card>>(STORAGE_KEYS.cards);

    expect(Object.keys(cards || {}).length).toBe(3);

    // Verify cards exist
    expect(requireDefined(cards)['two-sum']).toBeDefined();
    expect(requireDefined(cards)['valid-parentheses']).toBeDefined();
    expect(requireDefined(cards)['merge-two-sorted-lists']).toBeDefined();
  });
});

describe('removeCard', () => {
  beforeEach(() => {
    // Reset the fake browser state before each test
    fakeBrowser.reset();
  });

  it('should handle removing non-existent card gracefully', async () => {
    // Try to remove a card that doesn't exist
    await expect(removeCard('non-existent-slug')).resolves.toBeUndefined();

    // Verify storage is still empty/unchanged
    const cards = await storage.getItem<Record<string, Card>>(STORAGE_KEYS.cards);
    expect(cards || {}).toEqual({});
  });

  it('should not call deleteNote when removing non-existent card', async () => {
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

    expect(delayedCard.fsrs.due).toEqual(expect.any(Number));
    expect(delayedCard.fsrs.due).toBe(expectedDueDate.getTime());

    // Verify it was persisted to storage
    const cards = await storage.getItem<Record<string, Card>>(STORAGE_KEYS.cards);
    const storedCard = requireDefined(cards)['two-sum'];
    expect(storedCard.fsrs.due).toBe(expectedDueDate.getTime());
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
    expect(delayedCard.createdAt).toBe(ratedCard.createdAt);

    // FSRS properties except due should be preserved
    expect(delayedCard.fsrs.state).toBe(ratedCard.fsrs.state);
    expect(delayedCard.fsrs.reps).toBe(ratedCard.fsrs.reps);
    expect(delayedCard.fsrs.lapses).toBe(ratedCard.fsrs.lapses);
    expect(delayedCard.fsrs.stability).toBe(ratedCard.fsrs.stability);
    expect(delayedCard.fsrs.difficulty).toBe(ratedCard.fsrs.difficulty);
    expect(delayedCard.fsrs.last_review).toBe(ratedCard.fsrs.last_review);

    // Only due date should be different
    expect(delayedCard.fsrs.due).not.toBe(ratedCard.fsrs.due);
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

    expect(secondDelay.fsrs.due).toBe(expectedDueDate.getTime());
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

  it.each([
    [true, 'Easy'],
    [false, 'Medium'],
  ] as const)('should set and persist pause status to %s', async (paused, difficulty) => {
    await addCard({
      slug: 'set-pause-status',
      name: 'Set Pause Status',
      leetcodeId: '4500',
      difficulty,
      domain: 'leetcode.com',
    });
    if (!paused) await setPauseStatus('set-pause-status', true);

    const updatedCard = await setPauseStatus('set-pause-status', paused);

    expect(updatedCard.paused).toBe(paused);

    const allCards = await getAllCards();
    const card = allCards.find((c) => c.slug === 'set-pause-status');
    expect(card?.paused).toBe(paused);
  });

  it.each([true, false])('should handle setting an existing %s status again', async (paused) => {
    await addCard({
      slug: 'unchanged-status',
      name: 'Unchanged Status',
      leetcodeId: '5001',
      difficulty: 'Medium',
      domain: 'leetcode.com',
    });
    if (paused) await setPauseStatus('unchanged-status', true);

    const card = await setPauseStatus('unchanged-status', paused);
    expect(card.paused).toBe(paused);
  });

  it.each([true, false])('should reject status %s for a non-existent card', async (paused) => {
    await expect(setPauseStatus('non-existent', paused)).rejects.toThrow('Card with slug "non-existent" not found');
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
    expect(result.card.createdAt).toEqual(expect.any(Number));
    expect(result.card.fsrs).toBeDefined();

    // Verify the card was stored
    const cards = await storage.getItem<Record<string, Card>>(STORAGE_KEYS.cards);
    expect(requireDefined(cards)['new-problem']).toBeDefined();
  });

  it.each([0, 1710496800000])('schedules numeric dates from %i through repeated ratings', async (timestamp) => {
    vi.setSystemTime(timestamp);
    const problem = buildProblem();
    const initialCard = await addCard(problem);
    expect(initialCard.createdAt).toBe(timestamp);
    expect(initialCard.fsrs.due).toBe(timestamp);
    expect(initialCard.fsrs.last_review).toBeUndefined();

    const first = await rateCard({ ...problem, rating: Rating.Good });
    expect(first.card.fsrs.reps).toBe(initialCard.fsrs.reps + 1);
    expect(first.card.fsrs.stability).not.toBe(initialCard.fsrs.stability);
    expect(first.card.fsrs.last_review).toBe(timestamp);
    expect(first.card.fsrs.due).toBeGreaterThan(timestamp);

    vi.setSystemTime(first.card.fsrs.due);
    const second = await rateCard({ ...problem, rating: Rating.Good });
    expect(second.card.createdAt).toBe(timestamp);
    expect(second.card.fsrs.last_review).toBe(first.card.fsrs.due);
    expect(second.card.fsrs.due).toBeGreaterThan(first.card.fsrs.due);
    expect(second.card.fsrs.reps).toBe(first.card.fsrs.reps + 1);
    expect(await getAllCards()).toEqual([second.card]);
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

  it.each([Rating.Again, Rating.Hard, Rating.Good, Rating.Easy] as const)(
    'waits for the FSRS due time after rating %i instead of requeueing immediately',
    async (rating) => {
      const result = await rateCard({ ...buildProblem(), rating });
      expect(result.card.fsrs.due).toBeGreaterThan(Date.now());
      expect(result.shouldRequeue).toBe(false);
      expect(await getReviewQueue()).toEqual([]);

      vi.setSystemTime(result.card.fsrs.due - 1);
      expect(await getReviewQueue()).toEqual([]);
      vi.setSystemTime(result.card.fsrs.due);
      expect(await getReviewQueue()).toEqual([result.card]);
    }
  );

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

describe('getReviewQueue', () => {
  beforeEach(() => {
    fakeBrowser.reset();
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2024-01-15T12:00:00'));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('uses the full allowance when no completion stats exist', async () => {
    for (const slug of ['alpha', 'bravo', 'charlie', 'delta']) {
      await addCard(buildProblem({ slug }));
    }

    expect((await getReviewQueue()).map((card) => card.slug)).toEqual(['alpha', 'bravo', 'charlie']);
  });

  it('combines persisted rating completions with current settings', async () => {
    const completed = buildProblem({ slug: 'completed' });
    await rateCard({ ...completed, rating: Rating.Good });
    for (const slug of ['alpha', 'bravo', 'charlie', 'delta']) {
      await addCard(buildProblem({ slug }));
    }

    expect((await getReviewQueue()).map((card) => card.slug)).toEqual(['alpha', 'bravo']);
    mockGetSettings.mockResolvedValue(buildSettings({ maxNewCardsPerDay: 4 }));
    expect((await getReviewQueue()).map((card) => card.slug)).toEqual(['alpha', 'bravo', 'charlie']);
  });

  it.each([Rating.Again, Rating.Hard] as const)(
    'restores rating %i cards in due order when their interval ends',
    async (rating) => {
      const first = buildProblem({ slug: 'first-card' });
      await addCard(first);
      await addCard(buildProblem({ slug: 'second-card' }));
      await addCard(buildProblem({ slug: 'third-card' }));

      const result = await rateCard({ ...first, rating });
      expect((await getReviewQueue()).map((card) => card.slug)).toEqual(['second-card', 'third-card']);

      vi.setSystemTime(result.card.fsrs.due);
      expect((await getReviewQueue()).map((card) => card.slug)).toEqual(['second-card', 'third-card', 'first-card']);
    }
  );

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

    // Wait until the learning cards are due.
    vi.setSystemTime(new Date('2024-01-15T11:00:00'));

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
});
