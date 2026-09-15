import { queryOptions, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { background } from '@/shared/background-service';
import { type CatalogProblem, getProblemsByFrontendIds } from '@/shared/catalog';
import type { Card, RateCardInput } from '@/shared/models';
import { buildReviewQueue } from '@/shared/review';
import { usePopupClock } from '../hooks/usePopupClock';
import { learningDocumentQueryKey, readPopupLearningDocument } from './learning-document';

export type CardWithProblem = Card & CatalogProblem;

export const cardsQueryKey = [...learningDocumentQueryKey, 'cards'] as const;

const cardsQueryOptions = queryOptions({
  refetchOnMount: false,
  refetchOnWindowFocus: false,
  queryKey: cardsQueryKey,
  queryFn: async () => {
    const snapshot = await readPopupLearningDocument();
    await background.waitForInitialization();
    const savedCards = Object.values(snapshot.document.cards);
    const problems = await getProblemsByFrontendIds(savedCards);
    const cards = savedCards.map((card, index): CardWithProblem => {
      const problem = problems[index];
      if (!problem) throw new Error(`Unknown problem: ${card.frontendId} on ${card.domain}`);
      return { ...problem, ...card };
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

export function useReviewQueueQuery() {
  const now = usePopupClock();
  return useQuery({
    ...cardsQueryOptions,
    select: ({ document, cards }) => {
      const byId = new Map(cards.map((card) => [card.frontendId, card]));
      return buildReviewQueue(document, new Date(now)).map((card) => {
        const detailed = byId.get(card.frontendId);
        if (!detailed) throw new Error(`Missing problem details: ${card.frontendId}`);
        return detailed;
      });
    },
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
  return useCardMutation((frontendId: string) => background.removeCard(frontendId));
}

export function useRateCardMutation() {
  return useCardMutation((input: RateCardInput) => background.rateCard(input));
}

export function useDelayCardMutation() {
  return useCardMutation(({ frontendId, days }: { frontendId: string; days: number }) =>
    background.delayCard(frontendId, days)
  );
}

export function usePauseCardMutation() {
  return useCardMutation(({ frontendId, paused }: { frontendId: string; paused: boolean }) =>
    background.setPauseStatus(frontendId, paused)
  );
}
