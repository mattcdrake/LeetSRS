import type { LeetcodeDomain } from '@/domain/cards';
import { isDue } from '@/domain/review';
import { getAllCards } from '@/infrastructure/storage/cards';
import { getSettings } from './settings';

export async function shouldResetEditor(slug: string, domain: LeetcodeDomain): Promise<boolean> {
  const now = new Date();
  const settings = await getSettings();
  if (settings.resetEditorOnEveryProblem) {
    return true;
  }
  if (!settings.resetEditorOnDueReview) {
    return false;
  }

  const card = (await getAllCards()).find((candidate) => candidate.slug === slug && candidate.domain === domain);
  if (!card || card.paused) {
    return false;
  }

  return isDue(card, now);
}
