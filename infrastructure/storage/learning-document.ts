import { storage } from '#imports';
import { LEARNING_DOCUMENT_VERSION, type LearningDocument, learningDocumentSchema } from '@/domain/learning-document';
import { sendMessage } from '@/infrastructure/browser/messages';
import { STORAGE_KEYS } from './storage-keys';

export async function readLearningDocument(waitForInitialization = false): Promise<LearningDocument> {
  let document = await storage.getItem<unknown>(STORAGE_KEYS.learningDocument);

  if (
    waitForInitialization &&
    (document == null ||
      (typeof document === 'object' &&
        'schemaVersion' in document &&
        Number.isInteger(document.schemaVersion) &&
        Number(document.schemaVersion) < LEARNING_DOCUMENT_VERSION))
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
