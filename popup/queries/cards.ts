import { queryOptions, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { background } from '@/shared/background-service';
import { type CatalogProblem, getProblemsByFrontendIds } from '@/shared/catalog';
import type { Card, LearningDocument, ProblemReference, RateCardInput } from '@/shared/models';
import { buildReviewQueue } from '@/shared/review';
import { usePopupClock } from '../hooks/usePopupClock';
import { learningDocumentQueryKey, learningDocumentQueryOptions } from './learning-document';

export type CardWithProblem = Card & CatalogProblem;

// Catalog data is independent of learning-document edits and keyed only by references.
export function cardMetadataQueryOptions(cards: readonly ProblemReference[]) {
  const references = cards
    .map(({ frontendId, domain }) => ({ frontendId, domain }))
    .sort((a, b) => a.frontendId.localeCompare(b.frontendId) || a.domain.localeCompare(b.domain));
  return queryOptions({
    queryKey: ['popupCardMetadata', references] as const,
    staleTime: Infinity,
    refetchOnMount: false,
    refetchOnWindowFocus: false,
    queryFn: async () => {
      await background.waitForInitialization();
      const problems = await getProblemsByFrontendIds(references);
      return Object.fromEntries(
        references.map((reference, index) => {
          const problem = problems[index];
          if (!problem) throw new Error(`Unknown problem: ${reference.frontendId} on ${reference.domain}`);
          return [reference.frontendId, problem];
        })
      );
    },
  });
}

function useEnrichedCards(selectCards: (document: LearningDocument) => Card[]) {
  const document = useQuery(learningDocumentQueryOptions);
  const cards = Object.values(document.data?.cards ?? {});
  const metadata = useQuery({
    ...cardMetadataQueryOptions(cards),
    enabled: document.data !== undefined,
    // Keep open editors mounted when the remaining cards already have metadata.
    placeholderData: (previous) =>
      cards.every((card) => previous?.[card.frontendId]?.sources.includes(card.domain)) ? previous : undefined,
  });
  const problems = metadata.data;
  return {
    data:
      document.data && problems
        ? selectCards(document.data).map((card): CardWithProblem => ({ ...problems[card.frontendId], ...card }))
        : undefined,
    isLoading: document.isLoading || metadata.isLoading,
    error: document.error ?? metadata.error,
  };
}

export function useCardsQuery() {
  return useEnrichedCards((document) => Object.values(document.cards));
}

export function useReviewQueueQuery() {
  const now = usePopupClock();
  return useEnrichedCards((document) => buildReviewQueue(document, new Date(now)));
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
  return useCardMutation(async (input: RateCardInput) => {
    await background.rateCard(input);
  });
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
