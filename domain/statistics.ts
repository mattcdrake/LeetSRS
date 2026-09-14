import { z } from 'zod';
import { addLocalDays, formatLocalDate } from './calendar';
import type { Card } from './cards';
import { type Rating, Rating as RatingValue } from './ratings';

const count = z.int().nonnegative();

export const dailyStatsSchema = z.object({
  newCards: count,
  streak: count,
  gradeBreakdown: z.object({
    [RatingValue.Again]: count,
    [RatingValue.Hard]: count,
    [RatingValue.Good]: count,
    [RatingValue.Easy]: count,
  }),
});
export type DailyStats = z.infer<typeof dailyStatsSchema>;
export interface HistoryDailyStats extends DailyStats {
  date: string;
  totalReviews: number;
  reviewedCards: number;
}

export interface UpcomingReviewStats {
  date: string;
  count: number;
}

function createEmptyDailyStats(streak: number): DailyStats {
  return {
    gradeBreakdown: {
      [RatingValue.Again]: 0,
      [RatingValue.Hard]: 0,
      [RatingValue.Good]: 0,
      [RatingValue.Easy]: 0,
    },
    newCards: 0,
    streak,
  };
}

export function createDailyStats(yesterdayStats: DailyStats | undefined): DailyStats {
  const streak = yesterdayStats ? yesterdayStats.streak + 1 : 1;
  return createEmptyDailyStats(streak);
}

export function recordReview(
  stats: Record<string, DailyStats>,
  now: Date,
  rating: Rating,
  isNewCard: boolean
): Record<string, DailyStats> {
  const today = formatLocalDate(now);
  const yesterday = formatLocalDate(addLocalDays(now, -1));
  const todayStats = stats[today] ?? createDailyStats(stats[yesterday]);

  return {
    ...stats,
    [today]: {
      ...todayStats,
      newCards: todayStats.newCards + (isNewCard ? 1 : 0),
      gradeBreakdown: {
        ...todayStats.gradeBreakdown,
        [rating]: todayStats.gradeBreakdown[rating] + 1,
      },
    },
  };
}

function toHistoryDailyStats(date: string, stats: DailyStats): HistoryDailyStats {
  const totalReviews = Object.values(stats.gradeBreakdown).reduce((total, count) => total + count, 0);
  return {
    ...stats,
    date,
    totalReviews,
    reviewedCards: totalReviews - stats.newCards,
  };
}

export function calculateHistoryStats(
  stats: Record<string, DailyStats>,
  days: number,
  today: Date
): HistoryDailyStats[] {
  const result: HistoryDailyStats[] = [];
  for (let i = days - 1; i >= 0; i--) {
    const dateKey = formatLocalDate(addLocalDays(today, -i));
    const dailyStats = stats[dateKey] ?? createEmptyDailyStats(0);
    result.push(toHistoryDailyStats(dateKey, dailyStats));
  }

  return result;
}

export function calculateUpcomingStats(cards: Card[], days: number, today: Date): UpcomingReviewStats[] {
  const result: UpcomingReviewStats[] = [];
  const dateToIndex = new Map<string, number>();
  for (let i = 0; i < days; i++) {
    const dateKey = formatLocalDate(addLocalDays(today, i));
    result.push({
      date: dateKey,
      count: 0,
    });
    dateToIndex.set(dateKey, i);
  }

  if (result.length === 0) return result;

  const firstDate = result[0].date;

  for (const card of cards) {
    if (card.paused) continue;

    const dueKey = formatLocalDate(new Date(card.fsrs.due));

    if (dueKey <= firstDate) {
      result[0].count++;
      continue;
    }

    const bucketIndex = dateToIndex.get(dueKey);
    if (bucketIndex !== undefined) result[bucketIndex].count++;
  }

  return result;
}
