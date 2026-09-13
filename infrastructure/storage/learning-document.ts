import { storage } from '#imports';
import {
  LEARNING_DOCUMENT_VERSION,
  type LearningDocument,
  learningDocumentSchema,
  learningDocumentVersionSchema,
} from '@/domain/learning-document';
import { sendMessage } from '@/infrastructure/browser/messages';
import { STORAGE_KEYS } from './storage-keys';

export async function readLearningDocument(waitForInitialization = false): Promise<LearningDocument> {
  let document = await storage.getItem<unknown>(STORAGE_KEYS.learningDocument);
  const version = learningDocumentVersionSchema.safeParse(document);

  if (
    waitForInitialization &&
    (document == null || (version.success && version.data.schemaVersion < LEARNING_DOCUMENT_VERSION))
  ) {
    await sendMessage('waitForInitialization');
    document = await storage.getItem<unknown>(STORAGE_KEYS.learningDocument);
  }

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
