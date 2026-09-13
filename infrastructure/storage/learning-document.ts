import { storage } from '#imports';
import { type LearningDocument, learningDocumentSchema } from '@/domain/learning-document';
import { STORAGE_KEYS } from './storage-keys';

export async function readLearningDocument(): Promise<LearningDocument> {
  const document = await storage.getItem<unknown>(STORAGE_KEYS.learningDocument);

  if (document == null) {
    throw new Error('Learning document is not initialized');
  }

  return learningDocumentSchema.parse(document);
}

export async function replaceLearningDocument(document: LearningDocument): Promise<LearningDocument> {
  const validated = learningDocumentSchema.parse(document);

  await storage.setItem(STORAGE_KEYS.learningDocument, validated);
  return validated;
}
