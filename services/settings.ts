import type { SettingsUpdate } from '@/domain/settings';
import { readLearningDocument } from '@/infrastructure/storage/learning-document';
import { saveLocalLearningDocument } from './save-local-learning-document';

export async function updateSettings(changes: SettingsUpdate): Promise<void> {
  if (Object.keys(changes).length === 0) {
    return;
  }

  const now = new Date();
  const document = await readLearningDocument();
  await saveLocalLearningDocument({ ...document, settings: { ...document.settings, ...changes } }, now);
}
