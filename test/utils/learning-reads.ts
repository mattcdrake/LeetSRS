import { resolveLearningDocumentSettings } from '@/shared/settings';
import { readLearningDocument } from '@/shared/storage';

export async function getSettings() {
  return resolveLearningDocumentSettings(await readLearningDocument());
}
