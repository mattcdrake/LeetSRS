import { LEARNING_DOCUMENT_VERSION } from '@/domain/learning-document';
import { removeGistConnection } from '@/infrastructure/storage/gist-connection';
import { replaceLearningDocument } from '@/infrastructure/storage/learning-document';
import { parseLearningDocumentBackup } from '@/infrastructure/storage/learning-document-conversions';
import { removeLegacyLearningData } from '@/infrastructure/storage/learning-document-startup';
import { resetGistSyncStatus } from './gist-sync';

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
