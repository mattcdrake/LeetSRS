import { State as FsrsState } from 'ts-fsrs';
import { formatLocalDate } from './calendar';
import type { Card } from './cards';

export function isDueByDate(card: Card, referenceDate: Date, dayStartHour: number = 0): boolean {
  const dueDate = new Date(card.fsrs.due);

  const referenceDateStr = formatLocalDate(referenceDate, dayStartHour);
  const dueStr = formatLocalDate(dueDate, dayStartHour);
  return dueStr <= referenceDateStr;
}

const sortByDueDateThenSlug = (a: Card, b: Card): number => {
  const dueDiff = a.fsrs.due.getTime() - b.fsrs.due.getTime();
  if (dueDiff !== 0) return dueDiff;
  return a.slug.localeCompare(b.slug);
};

function partitionDueCards(dueCards: readonly Card[]): { reviewCards: Card[]; newCards: Card[] } {
  const reviewCards = dueCards.filter((card) => card.fsrs.state !== FsrsState.New);
  const newCards = dueCards.filter((card) => card.fsrs.state === FsrsState.New);
  newCards.sort(sortByDueDateThenSlug);
  return { reviewCards, newCards };
}

export function buildReviewQueue(
  eligibleCards: readonly Card[],
  maxNewCardsPerDay: number,
  newCardsCompletedToday: number
): Card[] {
  const { reviewCards, newCards } = partitionDueCards(eligibleCards);
  const remainingNewCards = Math.max(0, maxNewCardsPerDay - newCardsCompletedToday);
  const limitedNewCards = newCards.slice(0, remainingNewCards);
  const allQueueCards = [...reviewCards, ...limitedNewCards];
  allQueueCards.sort(sortByDueDateThenSlug);
  return allQueueCards;
}

export function calculateDelayedDueDate(due: Date, days: number): Date {
  const currentDueDate = new Date(due);
  const newDueDate = new Date(currentDueDate);
  newDueDate.setDate(newDueDate.getDate() + days);
  return newDueDate;
}
