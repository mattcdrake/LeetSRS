import type { LeetcodeDomain } from '@/shared/cards';
import { getAllCards, isDueByDate } from './cards';
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
