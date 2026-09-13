import { removeGistConnection } from '@/data/gist-connection';
import { replaceLearningDocument } from '@/data/learning-document';
import { parseLearningDocumentBackup } from '@/data/legacy/learning-document-conversions';
import { removeLegacyLearningData } from '@/data/legacy/learning-document-startup';
import { LEARNING_DOCUMENT_VERSION } from '@/domain/learning-document';
import { invalidateGistSync, resetGistSyncStatus } from './gist-sync';

export async function importData(json: string): Promise<void> {
  const document = parseLearningDocumentBackup(json);

  invalidateGistSync();
  await replaceLearningDocument(document);
}

export async function resetAllData(): Promise<void> {
  invalidateGistSync();
  await replaceLearningDocument({ schemaVersion: LEARNING_DOCUMENT_VERSION, cards: {}, stats: {}, settings: {} });
  await removeGistConnection();
  await resetGistSyncStatus();
  await removeLegacyLearningData();
}
