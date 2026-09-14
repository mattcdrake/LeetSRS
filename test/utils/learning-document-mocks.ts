import type { QueryClient } from '@tanstack/react-query';
import type { Card } from '@/domain/cards';
import { LEARNING_DOCUMENT_VERSION, type LearningDocument } from '@/domain/learning-document';
import { learningDocumentQueryKey } from '@/popup/queries/learning-document';

type LearningDocumentOverrides = Partial<Omit<LearningDocument, 'schemaVersion'>>;

export function buildLearningDocument(overrides: LearningDocumentOverrides = {}): LearningDocument {
  return { cards: {}, stats: {}, settings: {}, ...overrides, schemaVersion: LEARNING_DOCUMENT_VERSION };
}

export function setPopupLearningDocumentQueryData(
  queryClient: QueryClient,
  overrides: LearningDocumentOverrides = {},
  now = new Date()
) {
  const document = buildLearningDocument(overrides);
  queryClient.setQueryData(learningDocumentQueryKey, { document, now });
}

export function setPopupLearningCardsQueryData(queryClient: QueryClient, cards: Card[], now = new Date()) {
  const seen = new Set<string>();
  const uniqueCards = cards.map((card, index) => {
    if (!seen.has(card.slug)) {
      seen.add(card.slug);
      return card;
    }
    const slug = `${card.slug}-${index}`;
    return { ...card, id: slug, slug };
  });
  setPopupLearningDocumentQueryData(
    queryClient,
    { cards: Object.fromEntries(uniqueCards.map((card) => [card.slug, card])) },
    now
  );
}
