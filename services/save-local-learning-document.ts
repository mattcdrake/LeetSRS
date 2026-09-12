import type { LearningDocument } from '@/domain/learning-document';
import { replaceLearningDocument } from '@/infrastructure/storage/learning-document';

export async function saveLocalLearningDocument(document: LearningDocument, now: Date): Promise<void> {
  await replaceLearningDocument({ ...document, dataUpdatedAt: now.toISOString() });
}
