import { State as FsrsState } from 'ts-fsrs';
import type { Card } from './cards';

const sortByDueDateThenSlug = (a: Card, b: Card): number => {
  const dueDiff = a.fsrs.due.getTime() - b.fsrs.due.getTime();
  if (dueDiff !== 0) return dueDiff;
  return a.slug.localeCompare(b.slug);
};

export function partitionDueCards(dueCards: Card[]): { reviewCards: Card[]; newCards: Card[] } {
  const reviewCards = dueCards.filter((card) => card.fsrs.state !== FsrsState.New);
  const newCards = dueCards.filter((card) => card.fsrs.state === FsrsState.New);

  newCards.sort(sortByDueDateThenSlug);

  return { reviewCards, newCards };
}

export function buildReviewQueue(
  reviewCards: Card[],
  newCards: Card[],
  maxNewCardsPerDay: number,
  newCardsCompletedToday: number
): Card[] {
  const remainingNewCards = Math.max(0, maxNewCardsPerDay - newCardsCompletedToday);

  const limitedNewCards = newCards.slice(0, remainingNewCards);

  const allQueueCards = [...reviewCards, ...limitedNewCards];
  allQueueCards.sort(sortByDueDateThenSlug);

  return allQueueCards;
}
