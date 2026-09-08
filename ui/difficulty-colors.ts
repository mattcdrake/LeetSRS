import type { Difficulty } from '@/domain/cards';

export const DIFFICULTY_COLORS = {
  Easy: '#22c55e',
  Medium: '#f59e0b',
  Hard: '#ef4444',
} as const satisfies Record<Difficulty, string>;
