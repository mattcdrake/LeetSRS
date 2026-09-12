import {
  parseLearningDocumentBackup,
  readLearningDocument,
  replaceLearningDocument,
} from '@/infrastructure/storage/learning-document';

// Prepared for the coordinated runtime activation in #378.
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
