import { LEARNING_DOCUMENT_VERSION, type LearningDocument } from '@/domain/learning-document';

type LearningDocumentOverrides = Partial<Omit<LearningDocument, 'schemaVersion'>>;

export function buildLearningDocument(overrides: LearningDocumentOverrides = {}): LearningDocument {
  return { cards: {}, stats: {}, settings: {}, ...overrides, schemaVersion: LEARNING_DOCUMENT_VERSION };
}
