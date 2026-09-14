import { useQuery } from '@tanstack/react-query';
import { calculateHistoryStats, calculateUpcomingStats } from '@/popup/queries/statistics';
import { formatLocalDate } from '@/shared/calendar';
import { learningDocumentQueryOptions } from './learning-document';

export function useTodayStatsQuery() {
  return useQuery({
    ...learningDocumentQueryOptions,
    select: ({ document, now }) => document.stats[formatLocalDate(now)] ?? null,
  });
}

export function useLastNDaysStatsQuery(days: number) {
  return useQuery({
    ...learningDocumentQueryOptions,
    select: ({ document, now }) => calculateHistoryStats(document.stats, days, now),
  });
}

export function useNextNDaysStatsQuery(days: number) {
  return useQuery({
    ...learningDocumentQueryOptions,
    select: ({ document, now }) => calculateUpcomingStats(Object.values(document.cards), days, now),
  });
}
