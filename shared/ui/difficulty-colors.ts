import type { CatalogProblem } from '@/shared/catalog';

export const DIFFICULTY_COLORS = {
  easy: '#1cb8b8',
  medium: '#ffb800',
  hard: '#ff2d55',
} as const satisfies Record<CatalogProblem['difficulty'], string>;
