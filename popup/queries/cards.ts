import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { sendMessage } from '@/shared/messages';
import type { RateCardInput } from '@/shared/models';
import { buildReviewQueue } from '@/shared/review';
import { learningDocumentQueryKey, learningDocumentQueryOptions } from './learning-document';

export function useCardsQuery() {
  return useQuery({
    ...learningDocumentQueryOptions,
    select: ({ cards }) => cards,
  });
}

export function useReviewQueueQuery(options?: { refetchOnWindowFocus?: boolean }) {
  const { refetchOnWindowFocus = false } = options || {};
  return useQuery({
    ...learningDocumentQueryOptions,
    select: ({ document, now, cards }) => {
      const byId = new Map(cards.map((card) => [card.frontendId, card]));
      return buildReviewQueue(document, now).map((card) => {
        const detailed = byId.get(card.frontendId);
        if (!detailed) throw new Error(`Missing problem details: ${card.frontendId}`);
        return detailed;
      });
    },
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
  return useCardMutation((frontendId: string) => sendMessage('removeCard', { frontendId }));
}

export function useRateCardMutation() {
  return useCardMutation((input: RateCardInput) => sendMessage('rateCard', { input }));
}

export function useDelayCardMutation() {
  return useCardMutation(({ frontendId, days }: { frontendId: string; days: number }) =>
    sendMessage('delayCard', { frontendId, days })
  );
}

export function usePauseCardMutation() {
  return useCardMutation(({ frontendId, paused }: { frontendId: string; paused: boolean }) =>
    sendMessage('setPauseStatus', { frontendId, paused })
  );
}
