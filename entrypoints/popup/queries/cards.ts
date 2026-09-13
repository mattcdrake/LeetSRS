import { useMutation, useQuery } from '@tanstack/react-query';
import type { Card, RateCardInput } from '@/domain/cards';
import { sendMessage } from '@/infrastructure/browser/messages';
import { readLearningDocument } from '@/infrastructure/storage/learning-document';
import { getReviewQueue } from '@/infrastructure/storage/learning-queries';

export const cardQueryKeys = {
  all: ['cards'] as const,
  reviewQueue: ['cards', 'reviewQueue'] as const,
};

export function useCardsQuery() {
  return useQuery({
    queryKey: cardQueryKeys.all,
    networkMode: 'always',
    queryFn: async () => Object.values((await readLearningDocument(true)).cards),
  });
}

export function useReviewQueueQuery(options?: { refetchOnWindowFocus?: boolean }) {
  const { refetchOnWindowFocus = false } = options || {};
  return useQuery({
    queryKey: cardQueryKeys.reviewQueue,
    networkMode: 'always',
    queryFn: () => getReviewQueue(true),
    staleTime: 0,
    gcTime: 0,
    refetchInterval: 15_000,
    refetchOnWindowFocus,
  });
}

export function useRemoveCardMutation() {
  return useMutation({
    networkMode: 'always',
    mutationFn: (slug: string) => sendMessage('removeCard', { slug }),
  });
}

export function useRateCardMutation() {
  return useMutation<{ card: Card; shouldRequeue: boolean }, Error, RateCardInput>({
    networkMode: 'always',
    mutationFn: (input) => sendMessage('rateCard', { input }),
  });
}

export function useDelayCardMutation() {
  return useMutation<
    Card,
    Error,
    {
      slug: string;
      days: number;
    }
  >({
    networkMode: 'always',
    mutationFn: ({ slug, days }) => sendMessage('delayCard', { slug, days }),
  });
}

export function usePauseCardMutation() {
  return useMutation<
    Card,
    Error,
    {
      slug: string;
      paused: boolean;
    }
  >({
    networkMode: 'always',
    mutationFn: ({ slug, paused }) => sendMessage('setPauseStatus', { slug, paused }),
  });
}
