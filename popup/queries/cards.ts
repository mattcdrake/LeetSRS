import {
  QueryObserver,
  queryOptions,
  type UseQueryResult,
  useMutation,
  useQuery,
  useQueryClient,
} from '@tanstack/react-query';
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
      return references.map((reference, index) => {
        const problem = problems[index];
        if (!problem) throw new Error(`Unknown problem: ${reference.frontendId} on ${reference.domain}`);
        return problem;
      });
    },
  });
}

function useEnrichedCards(selectCards: (document: LearningDocument) => Card[]) {
  const queryClient = useQueryClient();
  const document = useQuery(learningDocumentQueryOptions);
  const options = (data: LearningDocument | undefined) => ({
    ...cardMetadataQueryOptions(Object.values(data?.cards ?? {})),
    enabled: data !== undefined,
    // Removing cards can reuse the previous batch while the smaller batch loads.
    // Keep existing card components mounted so open editors retain their state.
    placeholderData: (previous: CatalogProblem[] | undefined) =>
      data &&
      Object.values(data.cards).every((card) =>
        previous?.some((problem) => problem.frontendId === card.frontendId && problem.sources.includes(card.domain))
      )
        ? previous
        : undefined,
    select: (problems: CatalogProblem[]): CardWithProblem[] => {
      if (!data) return [];
      const byId = new Map(problems.map((problem) => [problem.frontendId, problem]));
      return selectCards(data).map((card) => {
        const problem = byId.get(card.frontendId);
        if (!problem) throw new Error(`Missing problem details: ${card.frontendId}`);
        return { ...problem, ...card };
      });
    },
  });
  const metadata = useQuery(options(document.data));
  const combine = (learning: typeof document, catalog: typeof metadata): UseQueryResult<CardWithProblem[], Error> => {
    if (learning.isPending) return { ...learning, data: undefined, refetch };
    if (learning.isError) {
      if (catalog.data !== undefined) {
        return { ...learning, data: catalog.data, isLoadingError: false, isRefetchError: true, refetch };
      }
      return { ...learning, data: undefined, isLoadingError: true, isRefetchError: false, refetch };
    }
    return {
      ...catalog,
      fetchStatus: learning.isFetching ? learning.fetchStatus : catalog.fetchStatus,
      isFetching: learning.isFetching || catalog.isFetching,
      isRefetching: learning.isRefetching || catalog.isRefetching,
      refetch,
    };
  };
  const refetch: typeof metadata.refetch = async (refetchOptions) => {
    const learning = await document.refetch(refetchOptions);
    if (!learning.isSuccess) return combine(learning, metadata);
    const nextOptions = options(learning.data);
    // Read the new references even when refetch changes the query key before React renders.
    const observer = new QueryObserver(queryClient, nextOptions);
    try {
      await queryClient.fetchQuery({ ...nextOptions, staleTime: 0 });
    } catch (error) {
      if (refetchOptions?.throwOnError) throw error;
    }
    return combine(learning, observer.getOptimisticResult(queryClient.defaultQueryOptions(nextOptions)));
  };
  return combine(document, metadata);
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
    onSettled: async () => {
      await queryClient.invalidateQueries({ queryKey: learningDocumentQueryKey });
      const document = queryClient.getQueryData(learningDocumentQueryOptions.queryKey);
      const observingCards = queryClient.getQueryCache().findAll({ queryKey: ['popupCardMetadata'], type: 'active' });
      if (document && observingCards.length > 0) {
        // Mutation completion includes enrichment, while refresh failures remain query errors.
        await queryClient.prefetchQuery(cardMetadataQueryOptions(Object.values(document.cards)));
      }
    },
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
