import { afterEach, describe, expect, it, vi } from 'vitest';
import { LearningState as State } from '@/domain/scheduling';
import { createMockCard } from '../card-mocks';

describe('createMockCard', () => {
  afterEach(() => vi.useRealTimers());

  it('returns deterministic defaults', () => {
    vi.useFakeTimers();
    vi.setSystemTime('2024-01-01T00:00:00.000Z');
    const first = createMockCard(State.New);

    vi.setSystemTime('2025-01-01T00:00:00.000Z');

    expect(createMockCard(State.New)).toEqual(first);
  });

  it('preserves explicit overrides', () => {
    const defaults = createMockCard(State.New);
    const fsrs = { ...defaults.fsrs, due: 123, last_review: 456 };

    expect(createMockCard(State.Review, { id: 'custom-id', createdAt: 789, fsrs })).toMatchObject({
      id: 'custom-id',
      createdAt: 789,
      fsrs,
    });
  });
});
