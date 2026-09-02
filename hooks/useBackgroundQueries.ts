import { useMutation, useQuery, useQueryClient, useSuspenseQuery } from '@tanstack/react-query';
import type { Card, ProblemDescriptor, RateCardInput } from '@/shared/cards';
import type { GistSyncConfig } from '@/shared/gist-sync';
import { sendMessage } from '@/shared/messages';
import type { Settings } from '@/shared/settings';

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
    cardState: ['stats', 'cardState'] as const,
    lastNDays: (days: number) => ['stats', 'lastNDays', days] as const,
    nextNDays: (days: number) => ['stats', 'nextNDays', days] as const,
  },
  // Settings related queries
  settings: {
    all: ['settings'] as const,
  },
  // Gist Sync related queries
  gistSync: {
    all: ['gistSync'] as const,
    config: ['gistSync', 'config'] as const,
    status: ['gistSync', 'status'] as const,
  },
} as const;

// Queries
export function useCardsQuery() {
  return useQuery({
    queryKey: queryKeys.cards.all,
    queryFn: () => sendMessage('getAllCards'),
  });
}

export function useReviewQueueQuery(options?: { enabled?: boolean; refetchOnWindowFocus?: boolean }) {
  const { enabled = true, refetchOnWindowFocus = false } = options || {};
  return useQuery({
    queryKey: queryKeys.cards.reviewQueue,
    queryFn: () => sendMessage('getReviewQueue'),
    enabled,
    staleTime: 0,
    gcTime: 0,
    refetchOnWindowFocus,
  });
}

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

export function useNoteQuery(cardId: string) {
  return useQuery({
    queryKey: queryKeys.notes.detail(cardId),
    queryFn: () => sendMessage('getNote', { cardId }),
    staleTime: 1000 * 60 * 5, // 5 minutes
  });
}

// Mutations
export function useAddCardMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (problem: ProblemDescriptor) => sendMessage('addCard', { problem }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.cards.all });
      queryClient.invalidateQueries({ queryKey: queryKeys.stats.all });
    },
  });
}

export function useRemoveCardMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (slug: string) => sendMessage('removeCard', { slug }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.cards.all });
      queryClient.invalidateQueries({ queryKey: queryKeys.stats.all });
    },
  });
}

export function useRateCardMutation() {
  const queryClient = useQueryClient();

  return useMutation<{ card: Card; shouldRequeue: boolean }, Error, RateCardInput>({
    mutationFn: (input) => sendMessage('rateCard', { input }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.cards.all });
      queryClient.invalidateQueries({ queryKey: queryKeys.stats.all });
    },
  });
}

export function useSaveNoteMutation(cardId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (text: string) => sendMessage('saveNote', { cardId, text }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.notes.detail(cardId) });
    },
  });
}

export function useDeleteNoteMutation(cardId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: () => sendMessage('deleteNote', { cardId }),
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
    mutationFn: ({ slug, days }) => sendMessage('delayCard', { slug, days }),
    onSuccess: () => {
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
    mutationFn: ({ slug, paused }) => sendMessage('setPauseStatus', { slug, paused }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.cards.all });
    },
  });
}

export function useSettingsQuery() {
  return useSuspenseQuery({
    queryKey: queryKeys.settings.all,
    queryFn: () => sendMessage('getSettings'),
  });
}

export function useUpdateSettingsMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (changes: Partial<Settings>) => sendMessage('updateSettings', { changes }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.settings.all });
      queryClient.invalidateQueries({ queryKey: queryKeys.cards.reviewQueue });
      queryClient.invalidateQueries({ queryKey: queryKeys.stats.all });
    },
  });
}

// Import/Export mutations
export function useExportDataMutation() {
  return useMutation({
    mutationFn: () => sendMessage('exportData'),
  });
}

export function useImportDataMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (jsonData: string) => sendMessage('importData', { jsonData }),
    onSuccess: () => {
      queryClient.invalidateQueries();
    },
  });
}

export function useResetAllDataMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: () => sendMessage('resetAllData'),
    onSuccess: () => {
      queryClient.invalidateQueries();
    },
  });
}

// Gist Sync queries and mutations
export function useGistSyncConfigQuery() {
  return useQuery({
    queryKey: queryKeys.gistSync.config,
    queryFn: () => sendMessage('getGistSyncConfig'),
  });
}

export function useGistSyncStatusQuery() {
  return useQuery({
    queryKey: queryKeys.gistSync.status,
    queryFn: () => sendMessage('getGistSyncStatus'),
    refetchInterval: 15000,
  });
}

export function useSetGistSyncConfigMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (config: Partial<GistSyncConfig>) => sendMessage('setGistSyncConfig', { config }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.gistSync.config });
    },
  });
}

export function useTriggerGistSyncMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: () => sendMessage('triggerGistSync'),
    onSuccess: () => {
      queryClient.invalidateQueries();
    },
  });
}

export function useCreateNewGistMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: () => sendMessage('createNewGist'),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.gistSync.all });
    },
  });
}

export function useValidatePatMutation() {
  return useMutation({
    mutationFn: (pat: string) => sendMessage('validatePat', { pat }),
  });
}

export function useValidateGistIdMutation() {
  return useMutation({
    mutationFn: ({ gistId, pat }: { gistId: string; pat: string }) => sendMessage('validateGistId', { gistId, pat }),
  });
}
