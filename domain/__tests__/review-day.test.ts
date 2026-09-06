import { createEmptyCard, State as FsrsState, State } from 'ts-fsrs';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Card } from '@/domain/cards';
import { createMockCard } from '@/test/utils/card-mocks';
import { formatLocalDate, isDueByDate } from '../review-day';

describe('isDueByDate', () => {
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

    expect(isDueByDate(newCard, new Date())).toBe(true);
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

    expect(isDueByDate(card, new Date())).toBe(true);
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

    expect(isDueByDate(card, new Date())).toBe(true);
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

    expect(isDueByDate(card, new Date())).toBe(true);
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

    expect(isDueByDate(card, new Date())).toBe(false);
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

    expect(isDueByDate(card, new Date())).toBe(false);
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

    expect(isDueByDate(card, new Date())).toBe(true);
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

    expect(isDueByDate(card, new Date())).toBe(true);
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

      expect(isDueByDate(cardDueToday, new Date())).toBe(true);
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

    expect(isDueByDate(cardDueToday, new Date())).toBe(true);

    // Card due tomorrow should not be included
    const cardDueTomorrow: Card = {
      ...cardDueToday,
      fsrs: {
        ...cardDueToday.fsrs,
        due: new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1, 0, 0, 1),
      },
    };

    expect(isDueByDate(cardDueTomorrow, new Date())).toBe(false);
  });
});

describe('review-day boundaries', () => {
  it.each([
    ['2024-03-15T03:59:59.999', 4, '2024-03-14', false],
    ['2024-03-15T04:00:00.000', 4, '2024-03-15', true],
    ['2024-01-01T03:59:59.999', 4, '2023-12-31', false],
    ['2024-01-01T04:00:00.000', 4, '2024-01-01', true],
    ['2024-03-01T03:59:59.999', 4, '2024-02-29', false],
    ['2024-03-01T04:00:00.000', 4, '2024-03-01', true],
  ])('uses the local review day at %s', (instant, dayStartHour, expectedDay, due) => {
    const referenceDate = new Date(instant);
    const card = createMockCard(State.Review);
    card.fsrs.due = new Date(referenceDate);
    card.fsrs.due.setHours(4, 0, 0, 0);

    expect(formatLocalDate(referenceDate, dayStartHour)).toBe(expectedDay);
    expect(isDueByDate(card, referenceDate, dayStartHour)).toBe(due);
    expect(referenceDate.getTime()).toBe(new Date(instant).getTime());
  });
});
