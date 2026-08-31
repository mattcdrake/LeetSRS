import { State as FsrsState } from 'ts-fsrs';
import { getAllCards, isDueByDate } from './cards';
import { getClearEditorOnReview, getDayStartHour } from './settings';
import type { LeetcodeDomain } from '@/shared/cards';
import type { ClearEditorOnReviewDecision } from '@/shared/messages';

export async function getClearEditorOnReviewDecision(
  slug: string,
  domain: LeetcodeDomain
): Promise<ClearEditorOnReviewDecision> {
  const enabled = await getClearEditorOnReview();
  if (!enabled) {
    return { shouldClear: false };
  }

  const cards = await getAllCards();
  const card = cards.find((candidate) => candidate.slug === slug && candidate.domain === domain);
  // Learning and relearning cards represent work in progress. Only an already
  // scheduled review should start with LeetCode's default editor contents.
  if (!card || card.paused || card.fsrs.state !== FsrsState.Review) {
    return { shouldClear: false };
  }

  const dayStartHour = await getDayStartHour();
  if (!isDueByDate(card, new Date(), dayStartHour)) {
    return { shouldClear: false };
  }

  return {
    shouldClear: true,
    questionFrontendId: card.leetcodeId,
  };
}
