import type { CatalogQuestion } from '@/shared/catalog';

export const DIFFICULTY_COLORS = {
  easy: '#22c55e',
  medium: '#f59e0b',
  hard: '#ef4444',
} as const satisfies Record<CatalogQuestion['difficulty'], string>;
