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

export async function updateStats(grade: Grade, isNewCard: boolean = false, now = new Date()): Promise<void> {
  const todayKey = formatLocalDate(now);
  const yesterdayKey = formatLocalDate(addLocalDays(now, -1));
  const stats = await getStats();

  if (!stats[todayKey]) {
    const yesterdayStats = stats[yesterdayKey];
    stats[todayKey] = createDailyStats(todayKey, yesterdayStats);
  }

  const todayStats = stats[todayKey];
  recordReview(todayStats, grade, isNewCard);

  await saveStats(stats);
}

export async function getTodayStats(): Promise<DailyStats | null> {
  const now = new Date();
  return getStatsForDate(formatLocalDate(now));
}

export async function getCardStateStats(): Promise<Record<FsrsState, number>> {
  const cards = await getAllCards();

  return countCardStates(cards);
}

export async function getLastNDaysStats(days: number): Promise<DailyStats[]> {
  const today = new Date();
  const stats = await getStats();
  return calculateHistoryStats(stats, days, today);
}

export async function getNextNDaysStats(days: number): Promise<UpcomingReviewStats[]> {
  const today = new Date();
  const cards = await getAllCards();
  return calculateUpcomingStats(cards, days, today);
}
