import { type Grade, Rating } from 'ts-fsrs';

const RATING_TOKENS = {
  [Rating.Again]: 'var(--ls-rating-again)',
  [Rating.Hard]: 'var(--ls-rating-hard)',
  [Rating.Good]: 'var(--ls-rating-good)',
  [Rating.Easy]: 'var(--ls-rating-easy)',
} as const satisfies Record<Grade, string>;

// The --ls-rating-* tokens in shared/ui/tokens.css follow each surface's theme.
export function ratingColor(rating: Grade): string {
  return RATING_TOKENS[rating];
}
