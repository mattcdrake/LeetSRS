import type { QueryClient } from '@tanstack/react-query';
import { type CardWithProblem, cardMetadataQueryOptions } from '@/popup/queries/cards';
import { learningDocumentQueryKey } from '@/popup/queries/learning-document';
import { catalogProblemSchema } from '@/shared/catalog';
import { cardSchema, LEARNING_DOCUMENT_VERSION, type LearningDocument } from '@/shared/models';

type LearningDocumentOverrides = Partial<Omit<LearningDocument, 'schemaVersion'>>;

export function buildLearningDocument(overrides: LearningDocumentOverrides = {}): LearningDocument {
  return {
    cards: {},
    reviewActivity: null,
    settings: {},
    activeRoadmapId: null,
    roadmapSkips: {},
    ...overrides,
    schemaVersion: LEARNING_DOCUMENT_VERSION,
  };
}

export function setPopupLearningCardsQueryData(queryClient: QueryClient, cards: CardWithProblem[]) {
  const document = buildLearningDocument({
    cards: Object.fromEntries(cards.map((card) => [card.frontendId, cardSchema.parse(card)])),
  });
  queryClient.setQueryData(learningDocumentQueryKey, document);
  queryClient.setQueryData(
    cardMetadataQueryOptions(cards).queryKey,
    Object.fromEntries(cards.map((card) => [card.frontendId, catalogProblemSchema.strip().parse(card)]))
  );
}
