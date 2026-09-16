import { queryOptions, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { background } from '@/shared/background-service';
import { type CatalogProblem, getProblemsByFrontendIds } from '@/shared/catalog';
import type { Card, LearningDocument, ProblemReference, RateCardInput } from '@/shared/models';
import { buildReviewQueue } from '@/shared/review';
import { usePopupClock } from '../hooks/usePopupClock';
import { learningDocumentQueryKey, learningDocumentQueryOptions } from './learning-document';

export type CardWithProblem = Card & CatalogProblem;

// Catalog data is independent of learning-document edits and keyed only by references.
function cardMetadataQueryOptions(cards: readonly ProblemReference[]) {
  const references = cards
    .map(({ frontendId, domain }) => ({ frontendId, domain }))
    .sort((a, b) => a.frontendId.localeCompare(b.frontendId) || a.domain.localeCompare(b.domain));
  return queryOptions({
    queryKey: ['popupCardMetadata', references] as const,
    staleTime: Infinity,
    gcTime: Infinity,
    refetchOnMount: false,
    refetchOnWindowFocus: false,
    queryFn: async () => {
      await background.waitForInitialization();
      const problems = await getProblemsByFrontendIds(references);
      return references.map((reference, index) => {
        const problem = problems[index];
        if (!problem) throw new Error(`Unknown problem: ${reference.frontendId} on ${reference.domain}`);
        return problem;
      });
    },
  });
}

export const cardsQueryKey = [...learningDocumentQueryKey, 'cards'] as const;

function useEnrichedCards(selectCards: (document: LearningDocument) => Card[]) {
  const queryClient = useQueryClient();
  // Subscribe to the canonical document; the cards query owns its refresh lifecycle.
  const { data: document } = useQuery({ ...learningDocumentQueryOptions, enabled: false });
  const query = useQuery({
    queryKey: cardsQueryKey,
    // A document refresh must rerun selectors even when catalog details are unchanged.
    structuralSharing: false,
    refetchOnMount: false,
    refetchOnWindowFocus: false,
    queryFn: async () => {
      const current = await queryClient.fetchQuery({ ...learningDocumentQueryOptions, staleTime: Infinity });
      return [...(await queryClient.fetchQuery(cardMetadataQueryOptions(Object.values(current.cards))))];
    },
    select: (problems): CardWithProblem[] => {
      const current = queryClient.getQueryData(learningDocumentQueryOptions.queryKey) ?? document;
      if (!current) return [];
      const byId = new Map(problems.map((problem) => [problem.frontendId, problem]));
      return selectCards(current).map((card) => {
        const problem = byId.get(card.frontendId);
        if (!problem) throw new Error(`Missing problem details: ${card.frontendId}`);
        return { ...problem, ...card };
      });
    },
  });
  return {
    ...query,
    refetch: (options?: Parameters<typeof query.refetch>[0]) => {
      void queryClient.invalidateQueries({ queryKey: learningDocumentQueryKey, exact: true, refetchType: 'none' });
      return query.refetch(options);
    },
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
