import type { CatalogProblem } from '@/shared/catalog';

// The popup defines these variables for its light and dark themes in `popup/App.css`.
export const DIFFICULTY_COLORS = {
  easy: 'var(--current-difficulty-easy)',
  medium: 'var(--current-difficulty-medium)',
  hard: 'var(--current-difficulty-hard)',
} as const satisfies Record<CatalogProblem['difficulty'], string>;
