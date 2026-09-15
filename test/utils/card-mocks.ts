import type { State } from 'ts-fsrs';
import type { CardWithQuestion } from '@/popup/queries/cards';
import type { CatalogQuestion } from '@/shared/catalog';
import type { Card, ProblemReference } from '@/shared/models';

const MOCK_TIMESTAMP = Date.parse('2024-01-01T00:00:00.000Z');

export function buildProblem(overrides: Partial<ProblemReference> = {}): ProblemReference {
  return { frontendId: '1', domain: 'leetcode.com', ...overrides };
}

export function buildCatalogQuestion(overrides: Partial<CatalogQuestion> = {}): CatalogQuestion {
  return {
    slug: 'two-sum',
    title: 'Two Sum',
    translatedTitle: '两数之和',
    isPaidOnly: false,
    topics: ['array'],
    sources: ['leetcode.com', 'leetcode.cn'],
    frontendId: '1',
    difficulty: 'easy',
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
    frontendId: '1',
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

export function createMockCardWithQuestion(state: State, overrides: Partial<CardWithQuestion> = {}): CardWithQuestion {
  return { ...createMockCard(state), ...buildCatalogQuestion(), ...overrides };
}
