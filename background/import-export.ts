import { parseLearningDocumentBackup } from '@/background/legacy/learning-document-conversions';
import { removeLegacyLearningData } from '@/background/legacy/learning-document-startup';
import { LEARNING_DOCUMENT_VERSION } from '@/shared/models';
import { removeGistConnection, replaceLearningDocument } from '@/shared/storage';
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
