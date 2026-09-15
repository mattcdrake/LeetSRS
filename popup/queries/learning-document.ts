import { queryOptions } from '@tanstack/react-query';
import { getCardWithProblem } from '@/shared/catalog';
import type { CardWithProblem, LearningDocument } from '@/shared/models';
import { readLearningDocument } from '@/shared/storage';

export const learningDocumentQueryKey = ['popupLearningDocument'] as const;

export interface PopupLearningDocumentSnapshot {
  document: LearningDocument;
  now: Date;
  cards: CardWithProblem[];
}

export const learningDocumentQueryOptions = queryOptions({
  queryKey: learningDocumentQueryKey,
  queryFn: async () => {
    const now = new Date();
    const document = await readLearningDocument();
    const cards = await Promise.all(Object.values(document.cards).map(getCardWithProblem));
    return { document, now, cards } satisfies PopupLearningDocumentSnapshot;
  },
  refetchOnMount: false,
  refetchInterval: 15_000,
});
