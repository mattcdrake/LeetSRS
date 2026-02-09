import { type Grade, Rating, State as FsrsState } from 'ts-fsrs';
import { STORAGE_KEYS } from './storage-keys';
import { storage } from '#imports';
import { getAllCards, isDueByDate, formatLocalDate } from './cards';
import { getDayStartHour } from './settings';
import { DAILY_STATS_RETENTION_DAYS } from '@/shared/settings';

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
  date: string; // YYYY-MM-DD format
  streak: number;
}

export interface MonthlyStats extends BaseStats {
  month: string; // YYYY-MM format
  activeDays: number;
}

async function getStats(): Promise<Record<string, DailyStats>> {
  const stats = await storage.getItem<Record<string, DailyStats>>(STORAGE_KEYS.stats);
  return stats ?? {};
}

export async function getMonthlyStats(): Promise<Record<string, MonthlyStats>> {
  const monthly = await storage.getItem<Record<string, MonthlyStats>>(STORAGE_KEYS.monthlyStats);
  return monthly ?? {};
}

export async function getTodayKey(): Promise<string> {
  const now = new Date();
  const dayStartHour = await getDayStartHour();
  return formatLocalDate(now, dayStartHour);
}

export async function getYesterdayKey(): Promise<string> {
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  const dayStartHour = await getDayStartHour();
  return formatLocalDate(yesterday, dayStartHour);
}

export async function updateStats(grade: Grade, isNewCard: boolean = false): Promise<void> {
  const stats = await getStats();
  const todayKey = await getTodayKey();

  if (!stats[todayKey]) {
    const yesterdayKey = await getYesterdayKey();
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

  await rollupOldStats();
}

export async function rollupOldStats(): Promise<void> {
  const stats = await getStats();
  const keys = Object.keys(stats);
  if (keys.length === 0) return;

  // Find the cutoff date (DAILY_STATS_RETENTION_DAYS ago from today)
  const now = new Date();
  const cutoff = new Date(now);
  cutoff.setDate(cutoff.getDate() - DAILY_STATS_RETENTION_DAYS);
  const cutoffKey = `${cutoff.getFullYear()}-${String(cutoff.getMonth() + 1).padStart(2, '0')}-${String(cutoff.getDate()).padStart(2, '0')}`;

  // Find entries older than the cutoff
  const oldKeys = keys.filter((key) => key < cutoffKey);
  if (oldKeys.length === 0) return;

  // Group old entries by month
  const monthlyStats = await getMonthlyStats();

  for (const key of oldKeys) {
    const daily = stats[key];
    const monthKey = key.slice(0, 7); // YYYY-MM

    if (!monthlyStats[monthKey]) {
      monthlyStats[monthKey] = {
        month: monthKey,
        totalReviews: 0,
        gradeBreakdown: {
          [Rating.Again]: 0,
          [Rating.Hard]: 0,
          [Rating.Good]: 0,
          [Rating.Easy]: 0,
        },
        newCards: 0,
        reviewedCards: 0,
        activeDays: 0,
      };
    }

    const monthly = monthlyStats[monthKey];
    monthly.totalReviews += daily.totalReviews;
    monthly.gradeBreakdown[Rating.Again] += daily.gradeBreakdown[Rating.Again];
    monthly.gradeBreakdown[Rating.Hard] += daily.gradeBreakdown[Rating.Hard];
    monthly.gradeBreakdown[Rating.Good] += daily.gradeBreakdown[Rating.Good];
    monthly.gradeBreakdown[Rating.Easy] += daily.gradeBreakdown[Rating.Easy];
    monthly.newCards += daily.newCards;
    monthly.reviewedCards += daily.reviewedCards;
    monthly.activeDays += 1;

    delete stats[key];
  }

  await storage.setItem(STORAGE_KEYS.monthlyStats, monthlyStats);
  await storage.setItem(STORAGE_KEYS.stats, stats);
}

export async function getStatsForDate(date: string): Promise<DailyStats | null> {
  const stats = await getStats();
  return stats[date] ?? null;
}

export async function getTodayStats(): Promise<DailyStats | null> {
  return getStatsForDate(await getTodayKey());
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
  const dayStartHour = await getDayStartHour();

  for (let i = days - 1; i >= 0; i--) {
    const date = new Date(today);
    date.setDate(date.getDate() - i);
    const dateKey = formatLocalDate(date, dayStartHour);

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
  const dayStartHour = await getDayStartHour();

  // Initialize result array with dates
  for (let i = 0; i < days; i++) {
    const date = new Date(today);
    date.setDate(date.getDate() + i);
    result.push({
      date: formatLocalDate(date, dayStartHour),
      count: 0,
    });
  }

  // Count cards due on each day
  for (const card of cards) {
    if (card.paused) continue;

    for (let i = 0; i < days; i++) {
      const checkDate = new Date(today);
      checkDate.setDate(checkDate.getDate() + i);

      if (isDueByDate(card, checkDate, dayStartHour)) {
        result[i].count++;
        break;
      }
    }
  }

  return result;
}
