import type { State } from 'ts-fsrs';
import type { Card, ProblemDescriptor } from '@/domain/cards';

const MOCK_TIMESTAMP = Date.parse('2024-01-01T00:00:00.000Z');

export function buildProblem(overrides: Partial<ProblemDescriptor> = {}): ProblemDescriptor {
  return {
    slug: 'two-sum',
    name: 'Two Sum',
    leetcodeId: '1',
    difficulty: 'Easy',
    domain: 'leetcode.com',
    ...overrides,
  };
}

/**
 * Creates a mock Card object for testing
 * @param state - The FSRS state for the card
 * @param overrides - Optional overrides for any Card properties
 * @returns A complete Card object with sensible defaults
 */
export const createMockCard = (state: State, overrides: Partial<Card> = {}): Card => {
  return {
    id: 'mock-id',
    slug: 'mock-slug',
    name: 'Mock Problem',
    leetcodeId: '1',
    difficulty: 'Easy',
    domain: 'leetcode.com',
    createdAt: MOCK_TIMESTAMP,
    fsrs: {
      state,
      due: MOCK_TIMESTAMP,
      stability: 1,
      difficulty: 1,
      elapsed_days: 0,
      scheduled_days: 0,
      reps: 1,
      lapses: 0,
      last_review: MOCK_TIMESTAMP,
      learning_steps: 0,
    },
    paused: false,
    ...overrides,
  };
};
