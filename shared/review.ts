import { State as FsrsState } from 'ts-fsrs';
import { formatLocalDate } from '@/shared/calendar';
import type { Card, LearningDocument } from '@/shared/models';
import { DEFAULT_SETTINGS } from '@/shared/settings';

export function isDue(card: Card, now: Date): boolean {
  return card.fsrs.due <= now.getTime();
}

const sortByDueDateThenSlug = (a: Card, b: Card): number => {
  const dueDiff = a.fsrs.due - b.fsrs.due;
  if (dueDiff !== 0) return dueDiff;
  return a.slug.localeCompare(b.slug);
};

function partitionDueCards(dueCards: readonly Card[]): { reviewCards: Card[]; newCards: Card[] } {
  const reviewCards = dueCards.filter((card) => card.fsrs.state !== FsrsState.New);
  const newCards = dueCards.filter((card) => card.fsrs.state === FsrsState.New);
  newCards.sort(sortByDueDateThenSlug);
  return { reviewCards, newCards };
}

export function buildReviewQueue(document: LearningDocument, now: Date): Card[] {
  const eligibleCards = Object.values(document.cards).filter((card) => !card.paused && isDue(card, now));
  const maxNewCardsPerDay = document.settings.maxNewCardsPerDay ?? DEFAULT_SETTINGS.maxNewCardsPerDay;
  const newCardsCompletedToday = document.stats[formatLocalDate(now)]?.newCards ?? 0;
  const { reviewCards, newCards } = partitionDueCards(eligibleCards);
  const remainingNewCards = Math.max(0, maxNewCardsPerDay - newCardsCompletedToday);
  const limitedNewCards = newCards.slice(0, remainingNewCards);
  const allQueueCards = [...reviewCards, ...limitedNewCards];
  allQueueCards.sort(sortByDueDateThenSlug);
  return allQueueCards;
}
