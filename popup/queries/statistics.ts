import { addLocalDays, formatLocalDate } from '@/shared/calendar';
import type { Card, DailyStats } from '@/shared/models';
import { createEmptyDailyStats } from '@/shared/models';
export interface HistoryDailyStats extends DailyStats {
  date: string;
  totalReviews: number;
  reviewedCards: number;
}

export interface UpcomingReviewStats {
  date: string;
  count: number;
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
