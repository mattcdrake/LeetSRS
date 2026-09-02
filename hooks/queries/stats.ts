import { useQuery } from '@tanstack/react-query';
import { sendMessage } from '@/shared/messages';
import { queryKeys } from '../useBackgroundQueries';

export function useTodayStatsQuery() {
  return useQuery({
    queryKey: queryKeys.stats.today,
    queryFn: () => sendMessage('getTodayStats'),
  });
}

export function useCardStateStatsQuery() {
  return useQuery({
    queryKey: queryKeys.stats.cardState,
    queryFn: () => sendMessage('getCardStateStats'),
  });
}

export function useLastNDaysStatsQuery(days: number) {
  return useQuery({
    queryKey: queryKeys.stats.lastNDays(days),
    queryFn: () => sendMessage('getLastNDaysStats', { days }),
  });
}

export function useNextNDaysStatsQuery(days: number) {
  return useQuery({
    queryKey: queryKeys.stats.nextNDays(days),
    queryFn: () => sendMessage('getNextNDaysStats', { days }),
  });
}
