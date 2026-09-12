import { LEARNING_DOCUMENT_VERSION } from '@/domain/learning-document';
import { removeGistConnection } from '@/infrastructure/storage/gist-connection';
import {
  parseLearningDocumentBackup,
  readLearningDocument,
  replaceLearningDocument,
} from '@/infrastructure/storage/learning-document';
import { removeLegacyLearningData } from '@/infrastructure/storage/learning-document-startup';
import { resetGistSyncStatus } from './document-gist-sync';

export async function exportData(): Promise<string> {
  const document = await readLearningDocument();
  if (!document) {
    throw new Error('Learning document is not initialized');
  }

  return JSON.stringify(document, null, 2);
}

export async function importData(json: string): Promise<void> {
  const document = parseLearningDocumentBackup(json);

  await replaceLearningDocument(document);
}

export async function resetAllData(): Promise<void> {
  await replaceLearningDocument({ schemaVersion: LEARNING_DOCUMENT_VERSION, cards: {}, stats: {}, settings: {} });
  await removeGistConnection();
  await resetGistSyncStatus();
  await removeLegacyLearningData();
}
