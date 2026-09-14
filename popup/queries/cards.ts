import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { sendMessage } from '@/shared/messages';
import type { RateCardInput } from '@/shared/models';
import { buildReviewQueue } from '@/shared/review';
import { learningDocumentQueryKey, learningDocumentQueryOptions } from './learning-document';

export function useCardsQuery() {
  return useQuery({
    ...learningDocumentQueryOptions,
    select: ({ document }) => Object.values(document.cards),
  });
}

export function useReviewQueueQuery(options?: { refetchOnWindowFocus?: boolean }) {
  const { refetchOnWindowFocus = false } = options || {};
  return useQuery({
    ...learningDocumentQueryOptions,
    select: ({ document, now }) => buildReviewQueue(document, now),
    refetchOnWindowFocus,
  });
}

function useCardMutation<TVariables>(mutationFn: (variables: TVariables) => Promise<void>) {
  const queryClient = useQueryClient();
  return useMutation<void, Error, TVariables>({
    mutationFn,
    onSettled: () => queryClient.invalidateQueries({ queryKey: learningDocumentQueryKey }),
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
