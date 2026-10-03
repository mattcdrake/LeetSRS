import { type Grade, Rating } from 'ts-fsrs';

// The --ls-rating-* tokens in shared/ui/tokens.css follow each surface's theme.
export const RATING_COLORS = {
  [Rating.Again]: 'var(--ls-rating-again)',
  [Rating.Hard]: 'var(--ls-rating-hard)',
  [Rating.Good]: 'var(--ls-rating-good)',
  [Rating.Easy]: 'var(--ls-rating-easy)',
} as const satisfies Record<Grade, string>;
