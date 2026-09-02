import { useQuery } from '@tanstack/react-query';
import { sendMessage } from '@/shared/messages';

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
    queryFn: () => sendMessage('getTodayStats'),
  });
}

export function useCardStateStatsQuery() {
  return useQuery({
    queryKey: statsQueryKeys.cardState,
    queryFn: () => sendMessage('getCardStateStats'),
  });
}

export function useLastNDaysStatsQuery(days: number) {
  return useQuery({
    queryKey: statsQueryKeys.lastNDays.detail(days),
    queryFn: () => sendMessage('getLastNDaysStats', { days }),
  });
}

export function useNextNDaysStatsQuery(days: number) {
  return useQuery({
    queryKey: statsQueryKeys.nextNDays.detail(days),
    queryFn: () => sendMessage('getNextNDaysStats', { days }),
  });
}
