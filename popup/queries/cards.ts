import { queryOptions, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { type CatalogQuestion, getQuestionsByFrontendIds } from '@/shared/catalog';
import { sendMessage } from '@/shared/messages';
import type { Card, RateCardInput } from '@/shared/models';
import { buildReviewQueue } from '@/shared/review';
import { learningDocumentQueryKey, readPopupLearningDocument } from './learning-document';

export type CardWithQuestion = Card & CatalogQuestion;

export const cardsQueryKey = [...learningDocumentQueryKey, 'cards'] as const;

const cardsQueryOptions = queryOptions({
  refetchOnMount: false,
  refetchInterval: 15_000,
  queryKey: cardsQueryKey,
  queryFn: async () => {
    const snapshot = await readPopupLearningDocument();
    await sendMessage('waitForInitialization');
    const savedCards = Object.values(snapshot.document.cards);
    const questions = await getQuestionsByFrontendIds(savedCards);
    const cards = savedCards.map((card, index): CardWithQuestion => {
      const question = questions[index];
      if (!question) throw new Error(`Unknown problem: ${card.frontendId} on ${card.domain}`);
      return { ...question, ...card };
    });
    return { ...snapshot, cards };
  },
});

export function useCardsQuery() {
  return useQuery({
    ...cardsQueryOptions,
    select: ({ cards }) => cards,
  });
}

export function useReviewQueueQuery(options?: { refetchOnWindowFocus?: boolean }) {
  const { refetchOnWindowFocus = false } = options || {};
  return useQuery({
    ...cardsQueryOptions,
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
