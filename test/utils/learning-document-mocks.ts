import type { QueryClient } from '@tanstack/react-query';
import { type CardWithQuestion, cardsQueryKey } from '@/popup/queries/cards';
import { learningDocumentQueryKey } from '@/popup/queries/learning-document';
import { cardSchema, LEARNING_DOCUMENT_VERSION, type LearningDocument } from '@/shared/models';
import { buildCatalogQuestion } from './card-mocks';

type LearningDocumentOverrides = Partial<Omit<LearningDocument, 'schemaVersion'>>;

export function buildLearningDocument(overrides: LearningDocumentOverrides = {}): LearningDocument {
  return { cards: {}, reviewActivity: null, settings: {}, ...overrides, schemaVersion: LEARNING_DOCUMENT_VERSION };
}

export function setPopupLearningDocumentQueryData(
  queryClient: QueryClient,
  overrides: LearningDocumentOverrides = {},
  now = new Date()
) {
  const document = buildLearningDocument(overrides);
  queryClient.setQueryData(learningDocumentQueryKey, { document, now });
  queryClient.setQueryData(cardsQueryKey, {
    document,
    now,
    cards: Object.values(document.cards).map((card) => ({ ...buildCatalogQuestion(), ...card })),
  });
}

export function setPopupLearningCardsQueryData(queryClient: QueryClient, cards: CardWithQuestion[], now = new Date()) {
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
  queryClient.setQueryData(learningDocumentQueryKey, { document, now });
  queryClient.setQueryData(cardsQueryKey, { document, now, cards: uniqueCards });
}
