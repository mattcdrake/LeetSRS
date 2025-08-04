import { State } from 'ts-fsrs';
import type { Card } from '@/types';

/**
 * Creates a mock Card object for testing
 * @param state - The FSRS state for the card
 * @param overrides - Optional overrides for any Card properties
 * @returns A complete Card object with sensible defaults
 */
export const createMockCard = (state: State, overrides: Partial<Card> = {}): Card => {
  const now = new Date();

  return {
    id: `mock-id-${Math.random()}`,
    slug: 'mock-slug',
    name: 'Mock Problem',
    leetcodeId: '1',
    difficulty: 'Easy',
    createdAt: now,
    fsrs: {
      state,
      due: now,
      stability: 1,
      difficulty: 1,
      elapsed_days: 0,
      scheduled_days: 0,
      reps: 1,
      lapses: 0,
      last_review: now,
      learning_steps: 0,
    },
    ...overrides,
  };
};

/**
 * Creates multiple mock cards with the same state
 * @param state - The FSRS state for all cards
 * @param count - Number of cards to create
 * @returns Array of Card objects
 */
export const createMockCards = (state: State, count: number): Card[] => {
  return Array(count)
    .fill(null)
    .map((_, index) =>
      createMockCard(state, {
        id: `mock-id-${state}-${index}`,
        slug: `mock-slug-${index}`,
      })
    );
};
