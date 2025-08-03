import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { sendMessage, MessageType } from '@/services/messages';
import type { Grade } from 'ts-fsrs';

// Query Keys
export const queryKeys = {
  cards: ['cards'] as const,
  reviewQueue: ['reviewQueue'] as const,
  todayStats: ['todayStats'] as const,
} as const;

// Queries
export function useCardsQuery() {
  return useQuery({
    queryKey: queryKeys.cards,
    queryFn: () => sendMessage({ type: MessageType.GET_ALL_CARDS }),
  });
}

export function useReviewQueueQuery(enabled = true) {
  return useQuery({
    queryKey: queryKeys.reviewQueue,
    queryFn: () => sendMessage({ type: MessageType.GET_REVIEW_QUEUE }),
    enabled,
    staleTime: 1000 * 30,
    refetchOnMount: 'always',
  });
}

export function useTodayStatsQuery() {
  return useQuery({
    queryKey: queryKeys.todayStats,
    queryFn: () => sendMessage({ type: MessageType.GET_TODAY_STATS }),
  });
}

// Mutations
export function useAddCardMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ slug, name }: { slug: string; name: string }) =>
      sendMessage({ type: MessageType.ADD_CARD, slug, name }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.cards });
      queryClient.invalidateQueries({ queryKey: queryKeys.reviewQueue });
    },
  });
}

export function useRemoveCardMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (slug: string) => sendMessage({ type: MessageType.REMOVE_CARD, slug }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.cards });
      queryClient.invalidateQueries({ queryKey: queryKeys.reviewQueue });
      queryClient.invalidateQueries({ queryKey: queryKeys.todayStats });
    },
  });
}

export function useRateCardMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ slug, rating }: { slug: string; rating: Grade }) =>
      sendMessage({ type: MessageType.RATE_CARD, slug, rating }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.cards });
      queryClient.invalidateQueries({ queryKey: queryKeys.reviewQueue });
      queryClient.invalidateQueries({ queryKey: queryKeys.todayStats });
    },
  });
}
