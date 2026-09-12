import { State as FsrsState } from 'ts-fsrs';
import type { Card, LeetcodeDomain } from './cards';
import type { Settings } from './settings';

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

export function calculateDelayedDueDate(due: number, days: number): number {
  const newDueDate = new Date(due);
  newDueDate.setDate(newDueDate.getDate() + days);
  return newDueDate.getTime();
}

export function shouldResetCardEditor(
  card: Card | undefined,
  domain: LeetcodeDomain,
  settings: Settings,
  now: Date
): boolean {
  if (settings.resetEditorOnEveryProblem) {
    return true;
  }
  return settings.resetEditorOnDueReview && !!card && card.domain === domain && !card.paused && isDue(card, now);
}
