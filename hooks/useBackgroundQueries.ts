import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { sendMessage, MessageType } from '@/services/messages';
import type { Grade } from 'ts-fsrs';
import type { Difficulty, Card } from '@/shared/cards';
import type { Theme } from '@/shared/settings';

// Query Keys
export const queryKeys = {
  cards: ['cards'] as const,
  reviewQueue: ['reviewQueue'] as const,
  todayStats: ['todayStats'] as const,
  note: (cardId: string) => ['note', cardId] as const,
  maxNewCardsPerDay: ['maxNewCardsPerDay'] as const,
  animationsEnabled: ['animationsEnabled'] as const,
  theme: ['theme'] as const,
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

  return useMutation<
    { card: Card; shouldRequeue: boolean },
    Error,
    {
      slug: string;
      name: string;
      rating: Grade;
      leetcodeId: string;
      difficulty: Difficulty;
    }
  >({
    mutationFn: ({ slug, name, rating, leetcodeId, difficulty }) =>
      sendMessage({ type: MessageType.RATE_CARD, slug, name, rating, leetcodeId, difficulty }),
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

export function useDelayCardMutation() {
  const queryClient = useQueryClient();

  return useMutation<
    Card,
    Error,
    {
      slug: string;
      days: number;
    }
  >({
    mutationFn: ({ slug, days }) => sendMessage({ type: MessageType.DELAY_CARD, slug, days }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.cards });
      queryClient.invalidateQueries({ queryKey: queryKeys.reviewQueue });
    },
  });
}

export function usePauseCardMutation() {
  const queryClient = useQueryClient();

  return useMutation<
    Card,
    Error,
    {
      slug: string;
      paused: boolean;
    }
  >({
    mutationFn: ({ slug, paused }) => sendMessage({ type: MessageType.SET_PAUSE_STATUS, slug, paused }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.cards });
      queryClient.invalidateQueries({ queryKey: queryKeys.reviewQueue });
    },
  });
}

export function useMaxNewCardsPerDayQuery() {
  return useQuery({
    queryKey: queryKeys.maxNewCardsPerDay,
    queryFn: () => sendMessage({ type: MessageType.GET_MAX_NEW_CARDS_PER_DAY }),
  });
}

export function useSetMaxNewCardsPerDayMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (value: number) => sendMessage({ type: MessageType.SET_MAX_NEW_CARDS_PER_DAY, value }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.maxNewCardsPerDay });
      queryClient.invalidateQueries({ queryKey: queryKeys.reviewQueue });
    },
  });
}

export function useAnimationsEnabledQuery() {
  return useQuery({
    queryKey: queryKeys.animationsEnabled,
    queryFn: () => sendMessage({ type: MessageType.GET_ANIMATIONS_ENABLED }),
  });
}

export function useSetAnimationsEnabledMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (value: boolean) => sendMessage({ type: MessageType.SET_ANIMATIONS_ENABLED, value }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.animationsEnabled });
    },
  });
}

export function useThemeQuery() {
  return useQuery({
    queryKey: queryKeys.theme,
    queryFn: () => sendMessage({ type: MessageType.GET_THEME }),
  });
}

export function useSetThemeMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (value: Theme) => sendMessage({ type: MessageType.SET_THEME, value }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.theme });
    },
  });
}
