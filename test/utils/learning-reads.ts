import { readLearningDocument } from '@/shared/learning-document';
import { resolveLearningDocumentSettings } from '@/shared/settings';

export async function getSettings() {
  return resolveLearningDocumentSettings(await readLearningDocument());
}
