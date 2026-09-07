import type { FSRS, Card as FsrsCard, Grade } from 'ts-fsrs';

export function scheduleReview(fsrs: FSRS, card: FsrsCard, now: Date, rating: Grade) {
  return fsrs.next(card, now, rating);
}
