import type { State as FsrsState, Grade } from 'ts-fsrs';
import { formatLocalDate } from '@/domain/calendar';
import {
  calculateHistoryStats,
  calculateUpcomingStats,
  countCardStates,
  createDailyStats,
  type DailyStats,
  recordReview,
  type UpcomingReviewStats,
} from '@/domain/statistics';
import { getAllCards } from '@/infrastructure/storage/cards/store';
import { getStats, getStatsForDate, saveStats } from '@/infrastructure/storage/stats';
import { getSettings } from './settings';

export async function getTodayKey(): Promise<string> {
  const now = new Date();
  const settings = await getSettings();
  return formatLocalDate(now, settings.dayStartHour);
}

export async function getYesterdayKey(): Promise<string> {
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  const settings = await getSettings();
  return formatLocalDate(yesterday, settings.dayStartHour);
}

export async function updateStats(grade: Grade, isNewCard: boolean = false): Promise<void> {
  const stats = await getStats();
  const todayKey = await getTodayKey();

  if (!stats[todayKey]) {
    const yesterdayKey = await getYesterdayKey();
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
  const { dayStartHour } = await getSettings();
  return calculateHistoryStats(stats, days, today, dayStartHour);
}

export async function getNextNDaysStats(days: number): Promise<UpcomingReviewStats[]> {
  const cards = await getAllCards();
  const today = new Date();
  const { dayStartHour } = await getSettings();
  return calculateUpcomingStats(cards, days, today, dayStartHour);
}
