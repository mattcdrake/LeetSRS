import { LEARNING_DOCUMENT_VERSION, type LearningDocument } from '@/shared/learning-document';

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
