import { type Grade, Rating } from 'ts-fsrs';
import { STORAGE_KEYS } from './storage-keys';
import { storage } from '#imports';

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
