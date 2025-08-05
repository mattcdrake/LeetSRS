import { type Grade, Rating, State as FsrsState } from 'ts-fsrs';
import { STORAGE_KEYS } from './storage-keys';
import { storage } from '#imports';
import { getAllCards, isDueByDate, formatLocalDate } from './cards';

export interface DailyStats {
  date: string; // YYYY-MM-DD format
  totalReviews: number;
  gradeBreakdown: {
    [Rating.Again]: number;
    [Rating.Hard]: number;
    [Rating.Good]: number;
    [Rating.Easy]: number;
  };
  newCards: number;
  reviewedCards: number;
  streak: number;
}

async function getStats(): Promise<Record<string, DailyStats>> {
  const stats = await storage.getItem<Record<string, DailyStats>>(STORAGE_KEYS.stats);
  return stats ?? {};
}

export function getTodayKey(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function getYesterdayKey(): string {
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  const year = yesterday.getFullYear();
  const month = String(yesterday.getMonth() + 1).padStart(2, '0');
  const day = String(yesterday.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export async function updateStats(grade: Grade, isNewCard: boolean = false): Promise<void> {
  const stats = await getStats();
  const todayKey = getTodayKey();

  if (!stats[todayKey]) {
    const yesterdayKey = getYesterdayKey();
    const yesterdayStats = stats[yesterdayKey];
    const streak = yesterdayStats ? yesterdayStats.streak + 1 : 1;

    stats[todayKey] = {
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
      streak,
    };
  }

  const todayStats = stats[todayKey];
  todayStats.totalReviews++;
  todayStats.gradeBreakdown[grade as keyof typeof todayStats.gradeBreakdown]++;

  if (isNewCard) {
    todayStats.newCards++;
  } else {
    todayStats.reviewedCards++;
  }

  await storage.setItem(STORAGE_KEYS.stats, stats);
}

export async function getStatsForDate(date: string): Promise<DailyStats | null> {
  const stats = await getStats();
  return stats[date] ?? null;
}

export async function getTodayStats(): Promise<DailyStats | null> {
  return getStatsForDate(getTodayKey());
}

export async function getAllStats(): Promise<DailyStats[]> {
  const stats = await getStats();
  return Object.values(stats).sort((a, b) => b.date.localeCompare(a.date));
}

export async function getCardStateStats(): Promise<Record<FsrsState, number>> {
  const cards = await getAllCards();

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

export async function getLastNDaysStats(days: number): Promise<DailyStats[]> {
  const stats = await getStats();
  const result: DailyStats[] = [];
  const today = new Date();

  for (let i = days - 1; i >= 0; i--) {
    const date = new Date(today);
    date.setDate(date.getDate() - i);
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const dateKey = `${year}-${month}-${day}`;

    if (stats[dateKey]) {
      result.push(stats[dateKey]);
    } else {
      // Include empty days for continuity in the chart
      result.push({
        date: dateKey,
        totalReviews: 0,
        gradeBreakdown: {
          [Rating.Again]: 0,
          [Rating.Hard]: 0,
          [Rating.Good]: 0,
          [Rating.Easy]: 0,
        },
        newCards: 0,
        reviewedCards: 0,
        streak: 0,
      });
    }
  }

  return result;
}

export interface UpcomingReviewStats {
  date: string; // YYYY-MM-DD format
  count: number;
}

export async function getNextNDaysStats(days: number): Promise<UpcomingReviewStats[]> {
  const cards = await getAllCards();
  const result: UpcomingReviewStats[] = [];
  const today = new Date();

  // Initialize result array with dates
  for (let i = 0; i < days; i++) {
    const date = new Date(today);
    date.setDate(date.getDate() + i);
    result.push({
      date: formatLocalDate(date),
      count: 0,
    });
  }

  // Count cards due on each day
  for (const card of cards) {
    if (card.paused) continue;

    for (let i = 0; i < days; i++) {
      const checkDate = new Date(today);
      checkDate.setDate(checkDate.getDate() + i);

      if (isDueByDate(card, checkDate)) {
        result[i].count++;
        break;
      }
    }
  }

  return result;
}
