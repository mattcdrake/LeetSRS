import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { background } from '@/shared/background-service';
import type { CatalogProblem } from '@/shared/catalog';
import type { Card, LearningDocument, RateCardInput } from '@/shared/models';
import { buildReviewQueue } from '@/shared/review';
import { usePopupClock } from '../hooks/usePopupClock';
import { catalogQueryOptions } from './catalog';
import { learningDocumentQueryKey, learningDocumentQueryOptions } from './learning-document';

export type CardWithProblem = Card & CatalogProblem;

function useEnrichedCardsQuery(selectCards: (document: LearningDocument) => Card[]) {
  const documentQuery = useQuery(learningDocumentQueryOptions);
  const document = documentQuery.data?.document;
  const catalogQuery = useQuery({
    ...catalogQueryOptions(Object.values(document?.cards ?? {})),
    enabled: document !== undefined,
    select: (problems) =>
      document ? selectCards(document).map((card): CardWithProblem => ({ ...problems[card.frontendId], ...card })) : [],
  });
  return {
    data: document ? catalogQuery.data : undefined,
    error: documentQuery.error ?? catalogQuery.error,
    isLoading: documentQuery.isLoading || (document !== undefined && catalogQuery.isLoading),
    isError: documentQuery.isError || catalogQuery.isError,
    isSuccess: documentQuery.isSuccess && catalogQuery.isSuccess,
    refetch: async () => {
      await documentQuery.refetch();
      await catalogQuery.refetch();
    },
  };
}

export function useCardsQuery() {
  return useEnrichedCardsQuery((document) => Object.values(document.cards));
}

export function useRawReviewQueueQuery() {
  const now = usePopupClock();
  return useQuery({
    ...learningDocumentQueryOptions,
    select: ({ document }) => buildReviewQueue(document, new Date(now)),
  });
}

export function useReviewQueueQuery() {
  const now = usePopupClock();
  return useEnrichedCardsQuery((document) => buildReviewQueue(document, new Date(now)));
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
