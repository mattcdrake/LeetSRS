import type { State as FsrsState, Grade } from 'ts-fsrs';
import { storage } from '#imports';
import { formatLocalDate } from '@/domain/review-day';
import {
  calculateHistoryStats,
  calculateUpcomingStats,
  countCardStates,
  createDailyStats,
  recordReview,
} from '@/domain/statistics';
import type { DailyStats, UpcomingReviewStats } from '@/domain/stats';
import { getAllCards } from '@/infrastructure/storage/cards';
import { STORAGE_KEYS } from '@/infrastructure/storage/storage-keys';
import { getSettings } from './settings';

async function getStats(): Promise<Record<string, DailyStats>> {
  const stats = await storage.getItem<Record<string, DailyStats>>(STORAGE_KEYS.stats);
  return stats ?? {};
}

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

  await storage.setItem(STORAGE_KEYS.stats, stats);
}

export async function getStatsForDate(date: string): Promise<DailyStats | null> {
  const stats = await getStats();
  return stats[date] ?? null;
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
