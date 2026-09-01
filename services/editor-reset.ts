import type { LeetcodeDomain } from '@/shared/cards';
import { getAllCards, isDueByDate } from './cards';
import { getDayStartHour, getResetEditorOnDueReview, getResetEditorOnEveryProblem } from './settings';

export async function shouldResetEditor(slug: string, domain: LeetcodeDomain): Promise<boolean> {
  if (await getResetEditorOnEveryProblem()) {
    return true;
  }
  if (!(await getResetEditorOnDueReview())) {
    return false;
  }

  const card = (await getAllCards()).find((candidate) => candidate.slug === slug && candidate.domain === domain);
  if (!card || card.paused) {
    return false;
  }

  return isDueByDate(card, new Date(), await getDayStartHour());
}
