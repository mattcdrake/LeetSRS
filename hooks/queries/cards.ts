import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { Card, ProblemDescriptor, RateCardInput } from '@/shared/cards';
import { sendMessage } from '@/shared/messages';
import { statsQueryKeys } from './stats';

export const cardQueryKeys = {
  all: ['cards'] as const,
  reviewQueue: ['cards', 'reviewQueue'] as const,
};

export function useCardsQuery() {
  return useQuery({
    queryKey: cardQueryKeys.all,
    queryFn: () => sendMessage('getAllCards'),
  });
}

export function useReviewQueueQuery(options?: { enabled?: boolean; refetchOnWindowFocus?: boolean }) {
  const { enabled = true, refetchOnWindowFocus = false } = options || {};
  return useQuery({
    queryKey: cardQueryKeys.reviewQueue,
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
      queryClient.invalidateQueries({ queryKey: cardQueryKeys.all });
      queryClient.invalidateQueries({ queryKey: statsQueryKeys.all });
    },
  });
}

export function useRemoveCardMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (slug: string) => sendMessage('removeCard', { slug }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: cardQueryKeys.all });
      queryClient.invalidateQueries({ queryKey: statsQueryKeys.all });
    },
  });
}

export function useRateCardMutation() {
  const queryClient = useQueryClient();

  return useMutation<{ card: Card; shouldRequeue: boolean }, Error, RateCardInput>({
    mutationFn: (input) => sendMessage('rateCard', { input }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: cardQueryKeys.all });
      queryClient.invalidateQueries({ queryKey: statsQueryKeys.all });
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
      queryClient.invalidateQueries({ queryKey: cardQueryKeys.all });
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
      queryClient.invalidateQueries({ queryKey: cardQueryKeys.all });
    },
  });
}
