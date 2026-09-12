import { storage } from '#imports';
import { type LearningDocument, learningDocumentSchema } from '@/domain/learning-document';
import { STORAGE_KEYS } from './storage-keys';

export async function readLearningDocument(): Promise<LearningDocument | undefined> {
  const document = await storage.getItem<unknown>(STORAGE_KEYS.learningDocument);

  if (document == null) {
    return undefined;
  }

  return learningDocumentSchema.parse(document);
}

export async function replaceLearningDocument(document: LearningDocument): Promise<void> {
  const validated = learningDocumentSchema.parse(document);

  await storage.setItem(STORAGE_KEYS.learningDocument, validated);
}

export async function requireLearningDocument(): Promise<LearningDocument> {
  const document = await readLearningDocument();
  if (!document) {
    throw new Error('Learning document is not initialized');
  }
  return document;
}
