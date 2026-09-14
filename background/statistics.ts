import { type Grade, Rating } from 'ts-fsrs';
import { addLocalDays, formatLocalDate } from '@/shared/calendar';
import type { DailyStats } from '@/shared/models';

function createEmptyDailyStats(streak: number): DailyStats {
  return {
    gradeBreakdown: {
      [Rating.Again]: 0,
      [Rating.Hard]: 0,
      [Rating.Good]: 0,
      [Rating.Easy]: 0,
    },
    newCards: 0,
    streak,
  };
}

export function createDailyStats(yesterdayStats: DailyStats | undefined): DailyStats {
  const streak = yesterdayStats ? yesterdayStats.streak + 1 : 1;
  return createEmptyDailyStats(streak);
}

export function recordReview(
  stats: Record<string, DailyStats>,
  now: Date,
  grade: Grade,
  isNewCard: boolean
): Record<string, DailyStats> {
  const today = formatLocalDate(now);
  const yesterday = formatLocalDate(addLocalDays(now, -1));
  const todayStats = stats[today] ?? createDailyStats(stats[yesterday]);

  return {
    ...stats,
    [today]: {
      ...todayStats,
      newCards: todayStats.newCards + (isNewCard ? 1 : 0),
      gradeBreakdown: {
        ...todayStats.gradeBreakdown,
        [grade]: todayStats.gradeBreakdown[grade] + 1,
      },
    },
  };
}
