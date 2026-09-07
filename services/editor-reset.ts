import type { LeetcodeDomain } from '@/domain/cards';
import { isDueByDate } from '@/domain/review';
import { getAllCards } from '@/infrastructure/storage/cards/store';
import { getSettings } from './settings';

export async function shouldResetEditor(slug: string, domain: LeetcodeDomain): Promise<boolean> {
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

  return isDueByDate(card, new Date(), settings.dayStartHour);
}
