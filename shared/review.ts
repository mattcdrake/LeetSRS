import { State as FsrsState } from 'ts-fsrs';
import { formatLocalDate } from '@/shared/calendar';
import type { Card, LearningDocument } from '@/shared/models';
import { DEFAULT_SETTINGS } from '@/shared/settings';

export function buildReviewQueue(document: LearningDocument, now: Date): Card[] {
  const eligibleCards = Object.values(document.cards).filter((card) => !card.paused && card.fsrs.due <= now.getTime());
  const maxNewCardsPerDay = document.settings.maxNewCardsPerDay ?? DEFAULT_SETTINGS.maxNewCardsPerDay;
  const newCardsCompletedToday =
    document.reviewActivity?.date === formatLocalDate(now) ? document.reviewActivity.newCards : 0;
  let remainingNewCards = Math.max(0, maxNewCardsPerDay - newCardsCompletedToday);
  eligibleCards.sort((a, b) => a.fsrs.due - b.fsrs.due);
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
