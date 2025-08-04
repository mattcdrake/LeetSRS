import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { sendMessage, MessageType } from '@/services/messages';
import type { Grade } from 'ts-fsrs';
import type { Difficulty } from '@/shared/cards';

// Query Keys
export const queryKeys = {
  cards: ['cards'] as const,
  reviewQueue: ['reviewQueue'] as const,
  todayStats: ['todayStats'] as const,
  note: (cardId: string) => ['note', cardId] as const,
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
export function useNoteQuery(cardId: string) {
  return useQuery({
    queryKey: queryKeys.note(cardId),
    queryFn: () => sendMessage({ type: MessageType.GET_NOTE, cardId }),
    staleTime: 1000 * 60 * 5, // 5 minutes
  });
}

// Mutations
export function useAddCardMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      slug,
      name,
      leetcodeId,
      difficulty,
    }: {
      slug: string;
      name: string;
      leetcodeId: string;
      difficulty: Difficulty;
    }) => sendMessage({ type: MessageType.ADD_CARD, slug, name, leetcodeId, difficulty }),
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
    mutationFn: ({
      slug,
      name,
      rating,
      leetcodeId,
      difficulty,
    }: {
      slug: string;
      name: string;
      rating: Grade;
      leetcodeId: string;
      difficulty: Difficulty;
    }) => sendMessage({ type: MessageType.RATE_CARD, slug, name, rating, leetcodeId, difficulty }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.cards });
      queryClient.invalidateQueries({ queryKey: queryKeys.reviewQueue });
      queryClient.invalidateQueries({ queryKey: queryKeys.todayStats });
    },
  });
}

export function useSaveNoteMutation(cardId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (text: string) => sendMessage({ type: MessageType.SAVE_NOTE, cardId, text }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.note(cardId) });
    },
  });
}

export function useDeleteNoteMutation(cardId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: () => sendMessage({ type: MessageType.DELETE_NOTE, cardId }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.note(cardId) });
    },
  });
}
