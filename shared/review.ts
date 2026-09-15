import { State as FsrsState } from 'ts-fsrs';
import { formatLocalDate } from '@/shared/calendar';
import type { Card, LearningDocument } from '@/shared/models';
import { DEFAULT_SETTINGS } from '@/shared/settings';

const sortByDueDateThenFrontendId = (a: Card, b: Card): number => {
  const dueDiff = a.fsrs.due - b.fsrs.due;
  if (dueDiff !== 0) return dueDiff;
  return a.frontendId.localeCompare(b.frontendId);
};

export function buildReviewQueue(document: LearningDocument, now: Date): Card[] {
  const eligibleCards = Object.values(document.cards).filter((card) => !card.paused && card.fsrs.due <= now.getTime());
  const maxNewCardsPerDay = document.settings.maxNewCardsPerDay ?? DEFAULT_SETTINGS.maxNewCardsPerDay;
  const newCardsCompletedToday =
    document.reviewActivity?.date === formatLocalDate(now) ? document.reviewActivity.newCards : 0;
  let remainingNewCards = Math.max(0, maxNewCardsPerDay - newCardsCompletedToday);
  eligibleCards.sort(sortByDueDateThenFrontendId);
  const queue: Card[] = [];
  for (const card of eligibleCards) {
    if (card.fsrs.state === FsrsState.New) {
      if (remainingNewCards === 0) continue;
      remainingNewCards--;
    }
    queue.push(card);
  }
  return queue;
}
