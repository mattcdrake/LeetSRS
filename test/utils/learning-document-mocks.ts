import type { LearningDocument } from '@/domain/learning-document';
export function buildLearningDocument(overrides: Partial<LearningDocument> = {}): LearningDocument {
  return { schemaVersion: 6, cards: {}, stats: {}, settings: {}, ...overrides };
}
