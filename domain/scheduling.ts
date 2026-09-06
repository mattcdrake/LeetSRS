import type { FSRS, Card as FsrsCard, Grade } from 'ts-fsrs';

export function scheduleReview(fsrs: FSRS, card: FsrsCard, now: Date, rating: Grade) {
  return fsrs.next(card, now, rating);
}

export function calculateDelayedDueDate(due: Date, days: number): Date {
  const currentDueDate = new Date(due);
  const newDueDate = new Date(currentDueDate);
  newDueDate.setDate(newDueDate.getDate() + days);
  return newDueDate;
}
