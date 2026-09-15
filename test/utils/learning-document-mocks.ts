import type { QueryClient } from '@tanstack/react-query';
import { learningDocumentQueryKey } from '@/popup/queries/learning-document';
import { type CardWithProblem, cardSchema, LEARNING_DOCUMENT_VERSION, type LearningDocument } from '@/shared/models';
import { buildProblemDescriptor } from './card-mocks';

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
  queryClient.setQueryData(learningDocumentQueryKey, {
    document,
    now,
    cards: Object.values(document.cards).map((card) => ({ ...buildProblemDescriptor(), ...card })),
  });
}

export function setPopupLearningCardsQueryData(queryClient: QueryClient, cards: CardWithProblem[], now = new Date()) {
  const seen = new Set<string>();
  const uniqueCards = cards.map((card, index) => {
    if (!seen.has(card.frontendId)) {
      seen.add(card.frontendId);
      return card;
    }
    const slug = `${card.frontendId}-${index}`;
    return { ...card, frontendId: slug };
  });
  const document = buildLearningDocument({
    cards: Object.fromEntries(uniqueCards.map((card) => [card.frontendId, cardSchema.parse(card)])),
  });
  queryClient.setQueryData(learningDocumentQueryKey, { document, now, cards: uniqueCards });
}
