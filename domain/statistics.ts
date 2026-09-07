import { State as FsrsState, type Grade, Rating } from 'ts-fsrs';
import { formatLocalDate } from './calendar';
import type { Card } from './cards';

interface BaseStats {
  totalReviews: number;
  gradeBreakdown: {
    [Rating.Again]: number;
    [Rating.Hard]: number;
    [Rating.Good]: number;
    [Rating.Easy]: number;
  };
  newCards: number;
  reviewedCards: number;
}

export interface DailyStats extends BaseStats {
  date: string;
  streak: number;
}

export interface UpcomingReviewStats {
  date: string;
  count: number;
}

function createEmptyBaseStats(): BaseStats {
  return {
    totalReviews: 0,
    gradeBreakdown: {
      [Rating.Again]: 0,
      [Rating.Hard]: 0,
      [Rating.Good]: 0,
      [Rating.Easy]: 0,
    },
    newCards: 0,
    reviewedCards: 0,
  };
}

export function createDailyStats(todayKey: string, yesterdayStats: DailyStats | undefined): DailyStats {
  const streak = yesterdayStats ? yesterdayStats.streak + 1 : 1;
  return { ...createEmptyBaseStats(), date: todayKey, streak };
}

export function recordReview(todayStats: DailyStats, grade: Grade, isNewCard: boolean): void {
  todayStats.totalReviews++;
  todayStats.gradeBreakdown[grade as keyof typeof todayStats.gradeBreakdown]++;

  if (isNewCard) {
    todayStats.newCards++;
  } else {
    todayStats.reviewedCards++;
  }
}

export function countCardStates(cards: Card[]): Record<FsrsState, number> {
  const stateStats: Record<FsrsState, number> = {
    [FsrsState.New]: 0,
    [FsrsState.Learning]: 0,
    [FsrsState.Review]: 0,
    [FsrsState.Relearning]: 0,
  };

  for (const card of cards) {
    const state = card.fsrs.state;
    stateStats[state]++;
  }

  return stateStats;
}

export function calculateHistoryStats(
  stats: Record<string, DailyStats>,
  days: number,
  today: Date,
  dayStartHour: number
): DailyStats[] {
  const result: DailyStats[] = [];
  for (let i = days - 1; i >= 0; i--) {
    const date = new Date(today);
    date.setDate(date.getDate() - i);
    const dateKey = formatLocalDate(date, dayStartHour);

    if (stats[dateKey]) {
      result.push(stats[dateKey]);
    } else {
      // Include empty days for continuity in the chart
      result.push({
        ...createEmptyBaseStats(),
        date: dateKey,
        streak: 0,
      });
    }
  }

  return result;
}

export function calculateUpcomingStats(
  cards: Card[],
  days: number,
  today: Date,
  dayStartHour: number
): UpcomingReviewStats[] {
  const result: UpcomingReviewStats[] = [];
  const dateToIndex = new Map<string, number>();
  for (let i = 0; i < days; i++) {
    const date = new Date(today);
    date.setDate(date.getDate() + i);
    const dateKey = formatLocalDate(date, dayStartHour);
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

    const dueKey = formatLocalDate(new Date(card.fsrs.due), dayStartHour);

    if (dueKey <= firstDate) {
      result[0].count++;
      continue;
    }

    const bucketIndex = dateToIndex.get(dueKey);
    if (bucketIndex !== undefined) result[bucketIndex].count++;
  }

  return result;
}
