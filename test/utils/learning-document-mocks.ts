import type { QueryClient } from '@tanstack/react-query';
import { type CardWithProblem, cardsQueryKey } from '@/popup/queries/cards';
import { learningDocumentQueryKey } from '@/popup/queries/learning-document';
import { catalogProblemSchema } from '@/shared/catalog';
import { cardSchema, LEARNING_DOCUMENT_VERSION, type LearningDocument } from '@/shared/models';
import { buildCatalogProblem } from './card-mocks';

type LearningDocumentOverrides = Partial<Omit<LearningDocument, 'schemaVersion'>>;

export function buildLearningDocument(overrides: LearningDocumentOverrides = {}): LearningDocument {
  return { cards: {}, reviewActivity: null, settings: {}, ...overrides, schemaVersion: LEARNING_DOCUMENT_VERSION };
}

export function setPopupLearningDocumentQueryData(queryClient: QueryClient, overrides: LearningDocumentOverrides = {}) {
  const document = buildLearningDocument(overrides);
  queryClient.setQueryData(learningDocumentQueryKey, document);
  const cards = Object.values(document.cards);
  queryClient.setQueryData(
    cardsQueryKey,
    cards.map((card) => buildCatalogProblem({ frontendId: card.frontendId }))
  );
}

export function setPopupLearningCardsQueryData(queryClient: QueryClient, cards: CardWithProblem[]) {
  const seen = new Set<string>();
  const uniqueCards = cards.map((card, index) => {
    if (!seen.has(card.frontendId)) {
      seen.add(card.frontendId);
      return card;
    }
    const frontendId = `${card.frontendId}-${index}`;
    return { ...card, frontendId };
  });
  const document = buildLearningDocument({
    cards: Object.fromEntries(uniqueCards.map((card) => [card.frontendId, cardSchema.parse(card)])),
  });
  queryClient.setQueryData(learningDocumentQueryKey, document);
  queryClient.setQueryData(
    cardsQueryKey,
    uniqueCards.map((card) => catalogProblemSchema.strip().parse(card))
  );
}
