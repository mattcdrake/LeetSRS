import { State as FsrsState, type Grade, Rating } from 'ts-fsrs';
import { storage } from '#imports';
import type { DailyStats, UpcomingReviewStats } from '@/shared/stats';
import { formatLocalDate, getAllCards } from './cards';
import { getSettings } from './settings';
import { STORAGE_KEYS } from './storage-keys';

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
    const streak = yesterdayStats ? yesterdayStats.streak + 1 : 1;

    stats[todayKey] = {
      ...createEmptyBaseStats(),
      date: todayKey,
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
  return getStatsForDate(await getTodayKey());
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
  const { dayStartHour } = await getSettings();

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

export async function getNextNDaysStats(days: number): Promise<UpcomingReviewStats[]> {
  const cards = await getAllCards();
  const result: UpcomingReviewStats[] = [];
  const dateToIndex = new Map<string, number>();
  const today = new Date();
  const { dayStartHour } = await getSettings();

  // Initialize result array with dates
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

  // Count cards due on each day
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
