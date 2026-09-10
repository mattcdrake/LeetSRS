import type { State as FsrsState, Grade } from 'ts-fsrs';
import { addLocalDays, formatLocalDate } from '@/domain/calendar';
import {
  calculateHistoryStats,
  calculateUpcomingStats,
  countCardStates,
  createDailyStats,
  type DailyStats,
  recordReview,
  type UpcomingReviewStats,
} from '@/domain/statistics';
import { getAllCards } from '@/infrastructure/storage/cards';
import { getStats, getStatsForDate, saveStats } from '@/infrastructure/storage/stats';

export async function getTodayKey(): Promise<string> {
  return formatLocalDate(new Date());
}

export async function getYesterdayKey(): Promise<string> {
  return formatLocalDate(addLocalDays(new Date(), -1));
}

export async function updateStats(grade: Grade, isNewCard: boolean = false): Promise<void> {
  const stats = await getStats();
  const now = new Date();
  const todayKey = formatLocalDate(now);

  if (!stats[todayKey]) {
    const yesterdayKey = formatLocalDate(addLocalDays(now, -1));
    const yesterdayStats = stats[yesterdayKey];
    stats[todayKey] = createDailyStats(todayKey, yesterdayStats);
  }

  const todayStats = stats[todayKey];
  recordReview(todayStats, grade, isNewCard);

  await saveStats(stats);
}

export async function getTodayStats(): Promise<DailyStats | null> {
  return getStatsForDate(await getTodayKey());
}

export async function getCardStateStats(): Promise<Record<FsrsState, number>> {
  const cards = await getAllCards();

  return countCardStates(cards);
}

export async function getLastNDaysStats(days: number): Promise<DailyStats[]> {
  const stats = await getStats();
  const today = new Date();
  return calculateHistoryStats(stats, days, today);
}

export async function getNextNDaysStats(days: number): Promise<UpcomingReviewStats[]> {
  const cards = await getAllCards();
  const today = new Date();
  return calculateUpcomingStats(cards, days, today);
}
