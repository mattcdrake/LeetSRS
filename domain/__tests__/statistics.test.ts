import { Rating, State } from 'ts-fsrs';
import { describe, expect, it } from 'vitest';
import { createMockCard } from '@/test/utils/card-mocks';
import {
  calculateHistoryStats,
  calculateUpcomingStats,
  createDailyStats,
  dailyStatsSchema,
  recordReview,
} from '../statistics';

describe('statistics calculations', () => {
  it('should return empty days when no stats exist', () => {
    const stats = calculateHistoryStats({}, 7, new Date('2024-03-15T10:00:00'));

    expect(stats).toHaveLength(7);
    stats.forEach((stat) => {
      expect(stat.totalReviews).toBe(0);
      expect(stat.newCards).toBe(0);
      expect(stat.reviewedCards).toBe(0);
      expect(stat.gradeBreakdown[Rating.Again]).toBe(0);
      expect(stat.gradeBreakdown[Rating.Hard]).toBe(0);
      expect(stat.gradeBreakdown[Rating.Good]).toBe(0);
      expect(stat.gradeBreakdown[Rating.Easy]).toBe(0);
    });
  });

  it('should handle large number of days', () => {
    const stats = calculateHistoryStats({}, 45, new Date('2024-03-15T10:00:00'));

    expect(stats).toHaveLength(45);

    // Check first and last dates
    expect(stats[0].date).toBe('2024-01-31');
    expect(stats[44].date).toBe('2024-03-15');
  });

  it.each([
    ['2024-03-15T00:00:00', undefined, '2024-03-15', 1],
    ['2024-03-15T00:00:00', '2024-03-13', '2024-03-15', 1],
    ['2025-01-01T00:00:00', '2024-12-31', '2025-01-01', 8],
    ['2024-03-10T23:59:59.999', '2024-03-09', '2024-03-10', 8],
    ['2024-11-03T23:59:59.999', '2024-11-02', '2024-11-03', 8],
  ] as const)('records a review at %s with prior day %s', (instant, priorDay, today, streak) => {
    const stats = priorDay ? { [priorDay]: { ...createDailyStats(undefined), streak: 7 } } : {};
    const before = structuredClone(stats);
    const now = new Date(instant);
    const result = recordReview(stats, now, Rating.Good, true);

    expect(result).toEqual({
      ...before,
      [today]: {
        streak,
        newCards: 1,
        gradeBreakdown: { [Rating.Again]: 0, [Rating.Hard]: 0, [Rating.Good]: 1, [Rating.Easy]: 0 },
      },
    });
    expect(stats).toEqual(before);
    expect(now).toEqual(new Date(instant));
  });

  it('continues streaks and accumulates each grade and card category', () => {
    const yesterday = recordReview({}, new Date('2024-03-14T12:00:00'), Rating.Good, true);
    const before = structuredClone(yesterday);
    const now = new Date('2024-03-15T12:00:00');
    let stats = recordReview(yesterday, now, Rating.Again, true);
    const firstReview = stats;
    const firstReviewBefore = structuredClone(firstReview);
    stats = recordReview(stats, now, Rating.Hard, false);
    stats = recordReview(stats, now, Rating.Good, false);
    stats = recordReview(stats, now, Rating.Easy, true);
    expect(stats).toEqual({
      ...before,
      '2024-03-15': {
        streak: 2,
        newCards: 2,
        gradeBreakdown: { [Rating.Again]: 1, [Rating.Hard]: 1, [Rating.Good]: 1, [Rating.Easy]: 1 },
      },
    });
    expect(yesterday).toEqual(before);
    expect(firstReview).toEqual(firstReviewBefore);
  });

  it('preserves saved history and inserts independent empty days using the supplied local date', () => {
    const stats = recordReview({}, new Date('2024-03-14T12:00:00'), Rating.Good, true);
    const result = calculateHistoryStats(stats, 3, new Date('2024-03-15T03:59:59'));
    expect(result.map((day) => day.date)).toEqual(['2024-03-13', '2024-03-14', '2024-03-15']);
    expect(result[1]).toEqual({
      ...stats['2024-03-14'],
      date: '2024-03-14',
      totalReviews: 1,
      reviewedCards: 0,
    });
    expect(result[0].streak).toBe(0);
    expect(result[2].streak).toBe(0);
    expect(result[0].gradeBreakdown).not.toBe(result[2].gradeBreakdown);
  });

  it('includes overdue cards but excludes paused cards from upcoming buckets', () => {
    const cards = [State.New, State.Learning, State.Review, State.Relearning].map((state) => createMockCard(state));
    cards[0].fsrs.due = new Date('2024-03-10T12:00:00').getTime();
    cards[1].fsrs.due = new Date('2024-03-15T23:59:59.999').getTime();
    cards[2].fsrs.due = new Date('2024-03-16T00:00:00').getTime();
    cards[3].fsrs.due = new Date('2024-03-16T00:00:00').getTime();
    cards[3].paused = true;
    expect(calculateUpcomingStats(cards, 2, new Date('2024-03-15T03:59:59'))).toEqual([
      { date: '2024-03-15', count: 2 },
      { date: '2024-03-16', count: 1 },
    ]);
  });

  it.each([
    ['2024-12-31T23:30:00', ['2024-12-30', '2024-12-31'], ['2024-12-31', '2025-01-01']],
    ['2024-03-10T23:30:00', ['2024-03-09', '2024-03-10'], ['2024-03-10', '2024-03-11']],
    ['2024-11-03T00:30:00', ['2024-11-02', '2024-11-03'], ['2024-11-03', '2024-11-04']],
  ])('keeps chart buckets on consecutive local dates at %s', (instant, history, upcoming) => {
    const today = new Date(instant);
    expect(calculateHistoryStats({}, 2, today).map((day) => day.date)).toEqual(history);
    expect(calculateUpcomingStats([], 2, today).map((day) => day.date)).toEqual(upcoming);
  });

  it.each([0, -1])('returns no buckets for %i days', (days) => {
    const today = new Date('2024-03-15T10:00:00');
    expect(calculateHistoryStats({}, days, today)).toEqual([]);
    expect(calculateUpcomingStats([], days, today)).toEqual([]);
  });
});

describe('daily statistics schema', () => {
  it('accepts leap days and zero counts while stripping nested unknown fields', () => {
    const stats = createDailyStats(undefined);
    expect(
      dailyStatsSchema.parse({
        ...stats,
        date: '2024-02-29',
        totalReviews: 0,
        reviewedCards: 0,
        extra: true,
        gradeBreakdown: { ...stats.gradeBreakdown, extra: 1 },
      })
    ).toEqual(stats);
  });

  it.each([
    { newCards: 0.5 },
    { streak: -1 },
    { gradeBreakdown: { 1: 0, 2: 0, 3: 0 } },
    { gradeBreakdown: { 1: 0, 2: 0, 3: -1, 4: 0 } },
  ])('rejects malformed statistics %j', (overrides) => {
    expect(dailyStatsSchema.safeParse({ ...createDailyStats(undefined), ...overrides }).success).toBe(false);
  });
});
