import { browser, storage } from '#imports';
import { type LearningDocument, learningDocumentSchema } from '@/domain/learning-document';
import { STORAGE_KEYS } from './storage-keys';

export async function readLearningDocument(): Promise<LearningDocument | undefined> {
  // Preserve presence: an explicit null is corrupt, not an absent document.
  const key = STORAGE_KEYS.learningDocument.slice('local:'.length);
  const values = await browser.storage.local.get(key);
  return values[key] === undefined ? undefined : learningDocumentSchema.parse(values[key]);
}

export async function replaceLearningDocument(document: LearningDocument): Promise<void> {
  const validated = learningDocumentSchema.parse(document);
  await storage.setItem(STORAGE_KEYS.learningDocument, validated);
}
