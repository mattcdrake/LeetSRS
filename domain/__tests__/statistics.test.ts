import { Rating, State } from 'ts-fsrs';
import { describe, expect, it } from 'vitest';
import { createMockCard } from '@/test/utils/card-mocks';
import {
  calculateHistoryStats,
  calculateUpcomingStats,
  countCardStates,
  createDailyStats,
  dailyStatsSchema,
  recordReview,
} from '../statistics';

describe('statistics calculations', () => {
  it('should return empty days when no stats exist', () => {
    const stats = calculateHistoryStats({}, 7, new Date('2024-03-15T10:00:00'), 0);

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
    const stats = calculateHistoryStats({}, 45, new Date('2024-03-15T10:00:00'), 0);

    expect(stats).toHaveLength(45);

    // Check first and last dates
    const firstDate = new Date('2024-03-15');
    firstDate.setDate(firstDate.getDate() - 44);
    expect(stats[0].date).toBe('2024-01-31');
    expect(stats[44].date).toBe('2024-03-15');
  });

  it('continues streaks and accumulates each grade and card category', () => {
    const yesterday = createDailyStats('2024-03-14', undefined);
    const today = createDailyStats('2024-03-15', yesterday);
    recordReview(today, Rating.Again, true);
    recordReview(today, Rating.Hard, false);
    recordReview(today, Rating.Good, false);
    recordReview(today, Rating.Easy, true);
    expect(today).toEqual({
      date: '2024-03-15',
      streak: 2,
      totalReviews: 4,
      newCards: 2,
      reviewedCards: 2,
      gradeBreakdown: { [Rating.Again]: 1, [Rating.Hard]: 1, [Rating.Good]: 1, [Rating.Easy]: 1 },
    });
    expect(yesterday.totalReviews).toBe(0);
  });

  it('preserves saved history and inserts independent empty days using the supplied review day', () => {
    const saved = createDailyStats('2024-03-13', undefined);
    recordReview(saved, Rating.Good, true);
    const result = calculateHistoryStats({ '2024-03-13': saved }, 3, new Date('2024-03-15T03:59:59'), 4);
    expect(result.map((day) => day.date)).toEqual(['2024-03-12', '2024-03-13', '2024-03-14']);
    expect(result[1]).toBe(saved);
    expect(result[0].streak).toBe(0);
    expect(result[2].streak).toBe(0);
    expect(result[0].gradeBreakdown).not.toBe(result[2].gradeBreakdown);
  });

  it('includes paused cards in state counts but excludes them from upcoming buckets', () => {
    const cards = [State.New, State.Learning, State.Review, State.Relearning].map((state) => createMockCard(state));
    cards[0].fsrs.due = new Date('2024-03-10T12:00:00').getTime();
    cards[1].fsrs.due = new Date('2024-03-15T03:59:59').getTime();
    cards[2].fsrs.due = new Date('2024-03-15T04:00:00').getTime();
    cards[3].fsrs.due = new Date('2024-03-15T04:00:00').getTime();
    cards[3].paused = true;
    expect(countCardStates(cards)).toEqual({
      [State.New]: 1,
      [State.Learning]: 1,
      [State.Review]: 1,
      [State.Relearning]: 1,
    });
    expect(calculateUpcomingStats(cards, 2, new Date('2024-03-15T03:59:59'), 4)).toEqual([
      { date: '2024-03-14', count: 2 },
      { date: '2024-03-15', count: 1 },
    ]);
  });

  it.each([0, -1])('returns no buckets for %i days', (days) => {
    const today = new Date('2024-03-15T10:00:00');
    expect(calculateHistoryStats({}, days, today, 4)).toEqual([]);
    expect(calculateUpcomingStats([], days, today, 4)).toEqual([]);
  });
});

describe('daily statistics schema', () => {
  it('accepts leap days and zero counts while stripping nested unknown fields', () => {
    const stats = createDailyStats('2024-02-29', undefined);
    expect(
      dailyStatsSchema.parse({ ...stats, extra: true, gradeBreakdown: { ...stats.gradeBreakdown, extra: 1 } })
    ).toEqual(stats);
  });

  it.each([
    { date: '2023-02-29' },
    { date: '2024-02-30' },
    { date: '2024-2-01' },
    { totalReviews: -1 },
    { newCards: 0.5 },
    { reviewedCards: Number.POSITIVE_INFINITY },
    { streak: -1 },
    { gradeBreakdown: { 1: 0, 2: 0, 3: 0 } },
    { gradeBreakdown: { 1: 0, 2: 0, 3: -1, 4: 0 } },
  ])('rejects malformed statistics %j', (overrides) => {
    expect(dailyStatsSchema.safeParse({ ...createDailyStats('2024-01-01', undefined), ...overrides }).success).toBe(
      false
    );
  });
});
