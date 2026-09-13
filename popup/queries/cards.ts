import { queryOptions, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { readLearningDocument } from '@/data/learning-document';
import { getReviewQueue } from '@/data/learning-queries';
import type { RateCardInput } from '@/domain/cards';
import { sendMessage } from '@/integrations/browser/messages';

export const cardQueryKeys = {
  all: ['cards'] as const,
  reviewQueue: ['cards', 'reviewQueue'] as const,
};

export const cardsQueryOptions = queryOptions({
  queryKey: cardQueryKeys.all,
  queryFn: async () => Object.values((await readLearningDocument(true)).cards),
});

export function useCardsQuery() {
  return useQuery(cardsQueryOptions);
}

export function useReviewQueueQuery(options?: { refetchOnWindowFocus?: boolean }) {
  const { refetchOnWindowFocus = false } = options || {};
  return useQuery({
    queryKey: cardQueryKeys.reviewQueue,
    queryFn: () => getReviewQueue(true),
    staleTime: 0,
    gcTime: 0,
    refetchInterval: 15_000,
    refetchOnWindowFocus,
  });
}

function useCardMutation<TVariables>(mutationFn: (variables: TVariables) => Promise<void>) {
  const queryClient = useQueryClient();
  return useMutation<void, Error, TVariables>({
    mutationFn,
    onSettled: () => queryClient.invalidateQueries({ queryKey: cardQueryKeys.all }),
  });
}

export function useRemoveCardMutation() {
  return useCardMutation((slug: string) => sendMessage('removeCard', { slug }));
}

export function useRateCardMutation() {
  return useCardMutation((input: RateCardInput) => sendMessage('rateCard', { input }));
}

export function useDelayCardMutation() {
  return useCardMutation(({ slug, days }: { slug: string; days: number }) => sendMessage('delayCard', { slug, days }));
}

export function usePauseCardMutation() {
  return useCardMutation(({ slug, paused }: { slug: string; paused: boolean }) =>
    sendMessage('setPauseStatus', { slug, paused })
  );
}
