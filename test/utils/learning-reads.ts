import { buildReviewQueue } from '@/shared/review';
import { resolveLearningDocumentSettings } from '@/shared/settings';
import { readLearningDocument } from '@/shared/storage';

export async function getReviewQueue() {
  const now = new Date();
  return buildReviewQueue(await readLearningDocument(), now);
}

export async function getSettings() {
  return resolveLearningDocumentSettings(await readLearningDocument());
}
