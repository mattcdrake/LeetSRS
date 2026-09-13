import { useQuery } from '@tanstack/react-query';
import { formatLocalDate } from '@/domain/calendar';
import { calculateHistoryStats, calculateUpcomingStats, countCardStates } from '@/domain/statistics';
import { readLearningDocument } from '@/infrastructure/storage/learning-document';

export const statsQueryKeys = {
  all: ['stats'] as const,
  today: ['stats', 'today'] as const,
  cardState: ['stats', 'cardState'] as const,
  lastNDays: {
    all: ['stats', 'lastNDays'] as const,
    detail: (days: number) => ['stats', 'lastNDays', days] as const,
  },
  nextNDays: {
    all: ['stats', 'nextNDays'] as const,
    detail: (days: number) => ['stats', 'nextNDays', days] as const,
  },
};

export function useTodayStatsQuery() {
  return useQuery({
    queryKey: statsQueryKeys.today,
    refetchInterval: 15_000,
    networkMode: 'always',
    queryFn: async () => {
      const now = new Date();
      const document = await readLearningDocument(true);
      return document.stats[formatLocalDate(now)] ?? null;
    },
  });
}

export function useCardStateStatsQuery() {
  return useQuery({
    queryKey: statsQueryKeys.cardState,
    networkMode: 'always',
    queryFn: async () => countCardStates(Object.values((await readLearningDocument(true)).cards)),
  });
}

export function useLastNDaysStatsQuery(days: number) {
  return useQuery({
    queryKey: statsQueryKeys.lastNDays.detail(days),
    refetchInterval: 15_000,
    networkMode: 'always',
    queryFn: async () => {
      const now = new Date();
      return calculateHistoryStats((await readLearningDocument(true)).stats, days, now);
    },
  });
}

export function useNextNDaysStatsQuery(days: number) {
  return useQuery({
    queryKey: statsQueryKeys.nextNDays.detail(days),
    refetchInterval: 15_000,
    networkMode: 'always',
    queryFn: async () => {
      const now = new Date();
      return calculateUpcomingStats(Object.values((await readLearningDocument(true)).cards), days, now);
    },
  });
}
