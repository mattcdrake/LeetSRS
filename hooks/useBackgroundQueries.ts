import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { sendMessage, MessageType } from '@/shared/messages';
import type { Grade } from 'ts-fsrs';
import type { Difficulty, Card } from '@/shared/cards';
import type { Theme } from '@/shared/settings';

// Query Keys with hierarchical structure
export const queryKeys = {
  // Card related queries
  cards: {
    all: ['cards'] as const,
    reviewQueue: ['cards', 'reviewQueue'] as const,
  },
  // Notes related queries
  notes: {
    all: ['notes'] as const,
    detail: (cardId: string) => ['notes', cardId] as const,
  },
  // Stats related queries
  stats: {
    all: ['stats'] as const,
    today: ['stats', 'today'] as const,
    allTime: ['stats', 'allTime'] as const,
    cardState: ['stats', 'cardState'] as const,
    lastNDays: (days: number) => ['stats', 'lastNDays', days] as const,
    nextNDays: (days: number) => ['stats', 'nextNDays', days] as const,
  },
  // Settings related queries
  settings: {
    all: ['settings'] as const,
    maxNewCardsPerDay: ['settings', 'maxNewCardsPerDay'] as const,
    animationsEnabled: ['settings', 'animationsEnabled'] as const,
    theme: ['settings', 'theme'] as const,
  },
} as const;

// Queries
export function useCardsQuery() {
  return useQuery({
    queryKey: queryKeys.cards.all,
    queryFn: () => sendMessage({ type: MessageType.GET_ALL_CARDS }),
  });
}

export function useReviewQueueQuery(options?: { enabled?: boolean; refetchOnWindowFocus?: boolean }) {
  const { enabled = true, refetchOnWindowFocus = false } = options || {};
  return useQuery({
    queryKey: queryKeys.cards.reviewQueue,
    queryFn: () => sendMessage({ type: MessageType.GET_REVIEW_QUEUE }),
    enabled,
    staleTime: 1000 * 30,
    refetchOnMount: 'always',
    refetchOnWindowFocus,
  });
}

export function useTodayStatsQuery() {
  return useQuery({
    queryKey: queryKeys.stats.today,
    queryFn: () => sendMessage({ type: MessageType.GET_TODAY_STATS }),
  });
}

export function useCardStateStatsQuery() {
  return useQuery({
    queryKey: queryKeys.stats.cardState,
    queryFn: () => sendMessage({ type: MessageType.GET_CARD_STATE_STATS }),
  });
}

export function useAllStatsQuery() {
  return useQuery({
    queryKey: queryKeys.stats.allTime,
    queryFn: () => sendMessage({ type: MessageType.GET_ALL_STATS }),
  });
}

export function useLastNDaysStatsQuery(days: number) {
  return useQuery({
    queryKey: queryKeys.stats.lastNDays(days),
    queryFn: () => sendMessage({ type: MessageType.GET_LAST_N_DAYS_STATS, days }),
  });
}

export function useNextNDaysStatsQuery(days: number) {
  return useQuery({
    queryKey: queryKeys.stats.nextNDays(days),
    queryFn: () => sendMessage({ type: MessageType.GET_NEXT_N_DAYS_STATS, days }),
  });
}

export function useNoteQuery(cardId: string) {
  return useQuery({
    queryKey: queryKeys.notes.detail(cardId),
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
      // Invalidate all card queries (includes reviewQueue)
      queryClient.invalidateQueries({ queryKey: ['cards'] });
    },
  });
}

export function useRemoveCardMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (slug: string) => sendMessage({ type: MessageType.REMOVE_CARD, slug }),
    onSuccess: () => {
      // Invalidate all card queries
      queryClient.invalidateQueries({ queryKey: ['cards'] });
      // Invalidate today's stats
      queryClient.invalidateQueries({ queryKey: queryKeys.stats.today });
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
      // Invalidate all card queries
      queryClient.invalidateQueries({ queryKey: ['cards'] });
      // Invalidate all stats queries with one call
      queryClient.invalidateQueries({ queryKey: ['stats'] });
    },
  });
}

export function useSaveNoteMutation(cardId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (text: string) => sendMessage({ type: MessageType.SAVE_NOTE, cardId, text }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.notes.detail(cardId) });
    },
  });
}

export function useDeleteNoteMutation(cardId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: () => sendMessage({ type: MessageType.DELETE_NOTE, cardId }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.notes.detail(cardId) });
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
      // Invalidate all card queries
      queryClient.invalidateQueries({ queryKey: queryKeys.cards.all });
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
      // Invalidate all card queries
      queryClient.invalidateQueries({ queryKey: queryKeys.cards.all });
    },
  });
}

export function useMaxNewCardsPerDayQuery() {
  return useQuery({
    queryKey: queryKeys.settings.maxNewCardsPerDay,
    queryFn: () => sendMessage({ type: MessageType.GET_MAX_NEW_CARDS_PER_DAY }),
  });
}

export function useSetMaxNewCardsPerDayMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (value: number) => sendMessage({ type: MessageType.SET_MAX_NEW_CARDS_PER_DAY, value }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.settings.maxNewCardsPerDay });
      queryClient.invalidateQueries({ queryKey: queryKeys.cards.reviewQueue });
    },
  });
}

export function useAnimationsEnabledQuery() {
  return useQuery({
    queryKey: queryKeys.settings.animationsEnabled,
    queryFn: () => sendMessage({ type: MessageType.GET_ANIMATIONS_ENABLED }),
  });
}

export function useSetAnimationsEnabledMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (value: boolean) => sendMessage({ type: MessageType.SET_ANIMATIONS_ENABLED, value }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.settings.animationsEnabled });
    },
  });
}

export function useThemeQuery() {
  return useQuery({
    queryKey: queryKeys.settings.theme,
    queryFn: () => sendMessage({ type: MessageType.GET_THEME }),
  });
}

export function useSetThemeMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (value: Theme) => sendMessage({ type: MessageType.SET_THEME, value }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.settings.theme });
    },
  });
}

// Import/Export mutations
export function useExportDataMutation() {
  return useMutation({
    mutationFn: () => sendMessage({ type: MessageType.EXPORT_DATA }),
  });
}

export function useImportDataMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (jsonData: string) => sendMessage({ type: MessageType.IMPORT_DATA, jsonData }),
    onSuccess: () => {
      // Clear all queries to refresh data after import
      queryClient.clear();
    },
  });
}

export function useResetAllDataMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: () => sendMessage({ type: MessageType.RESET_ALL_DATA }),
    onSuccess: () => {
      // Clear all queries to refresh data after reset
      queryClient.clear();
    },
  });
}
