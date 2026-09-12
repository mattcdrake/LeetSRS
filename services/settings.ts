import { learningDocumentSchema } from '@/domain/learning-document';
import { resolveSettings, type Settings, type SettingsUpdate, settingsUpdateSchema } from '@/domain/settings';
import { detectBrowserLanguage } from '@/infrastructure/browser/language';
import { readLearningDocument, replaceLearningDocument } from '@/infrastructure/storage/learning-document';

export async function getSettings(): Promise<Settings> {
  const document = await readLearningDocument();
  if (!document) {
    throw new Error('Learning document is not initialized');
  }

  return resolveSettings(document.settings, document.settings.language ?? detectBrowserLanguage());
}

export async function updateSettings(changes: SettingsUpdate): Promise<void> {
  const parsedChanges = settingsUpdateSchema.parse(changes);
  if (Object.keys(parsedChanges).length === 0) {
    return;
  }

  const document = await readLearningDocument();
  if (!document) {
    throw new Error('Learning document is not initialized');
  }

  const next = learningDocumentSchema.parse({
    ...document,
    settings: { ...document.settings, ...parsedChanges },
    dataUpdatedAt: new Date().toISOString(),
  });
  await replaceLearningDocument(next);
}
