import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { Card, ProblemDescriptor, RateCardInput } from '@/shared/cards';
import { sendMessage } from '@/shared/messages';
import { queryKeys } from '../useBackgroundQueries';

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
