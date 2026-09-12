import { storage } from '#imports';
import { type LearningDocument, learningDocumentSchema } from '@/domain/learning-document';
import { STORAGE_KEYS } from './storage-keys';

export async function readLearningDocument(): Promise<LearningDocument | undefined> {
  const document = await storage.getItem<unknown>(STORAGE_KEYS.learningDocument);
  return document == null ? undefined : learningDocumentSchema.parse(document);
}

export async function replaceLearningDocument(document: LearningDocument): Promise<void> {
  const validated = learningDocumentSchema.parse(document);
  await storage.setItem(STORAGE_KEYS.learningDocument, validated);
}
