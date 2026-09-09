import { type CardInput, createEmptyCard, FSRS, Rating, State } from 'ts-fsrs';
import { describe, expect, expectTypeOf, it } from 'vitest';
import { createMockCard } from '@/test/utils/card-mocks';
import { cardSchema, type FsrsCard } from '../cards';

describe('card schemas', () => {
  it('accepts an unreviewed numeric card as an FSRS input', () => {
    const now = 1_700_000_000_000;
    const empty = createEmptyCard(now);
    const card = cardSchema.parse({ ...createMockCard(State.New), fsrs: { ...empty, due: now } });

    expectTypeOf<FsrsCard>().toExtend<CardInput>();
    expect(card.fsrs).toEqual({ ...empty, due: now });
    expect(card.fsrs.last_review).toBeUndefined();
    const scheduler = new FSRS({ enable_fuzz: false });
    expect(scheduler.next(card.fsrs, now, Rating.Good)).toEqual(scheduler.next(empty, now, Rating.Good));
  });

  it.each(['id', 'slug', 'name', 'leetcodeId'])('rejects empty %s without trimming valid values', (field) => {
    const card = createMockCard(State.Review);
    const result = cardSchema.safeParse({ ...card, [field]: ' \t ' });
    expect(result.success).toBe(false);
    expect(result.error?.issues).toEqual([
      expect.objectContaining({
        path: [field],
        message: 'Must contain at least one non-whitespace character',
      }),
    ]);
    expect(cardSchema.parse({ ...card, [field]: '  value  ' })).toHaveProperty(field, '  value  ');
  });

  it.each([
    { domain: 'leetcode.org' },
    { difficulty: 'easy' },
    { paused: 0 },
    { createdAt: '2024-01-01' },
    { createdAt: 8_640_000_000_000_001 },
    { fsrs: { due: -8_640_000_000_000_001 } },
    { fsrs: { last_review: null } },
    { fsrs: { last_review: Number.NaN } },
    { fsrs: { last_review: 1e100 } },
    { fsrs: { state: 4 } },
    { fsrs: { stability: -1 } },
    { fsrs: { difficulty: Number.POSITIVE_INFINITY } },
    { fsrs: { elapsed_days: -1 } },
    { fsrs: { scheduled_days: -1 } },
    { fsrs: { reps: 0.5 } },
    { fsrs: { lapses: -1 } },
    { fsrs: { learning_steps: 0.5 } },
  ])('rejects malformed fields: %j', (overrides) => {
    const card = createMockCard(State.Review);
    expect(cardSchema.safeParse({ ...card, ...overrides, fsrs: { ...card.fsrs, ...overrides.fsrs } }).success).toBe(
      false
    );
  });

  it('retains numeric date boundaries and fractional scheduling values while stripping nested unknown fields', () => {
    const card = createMockCard(State.Review, { createdAt: -8_640_000_000_000_000 });
    card.fsrs.due = 8_640_000_000_000_000;
    card.fsrs.last_review = -0.5;
    card.fsrs.elapsed_days = 0.5;
    card.fsrs.scheduled_days = 1.5;
    expect(cardSchema.parse({ ...card, extra: true, fsrs: { ...card.fsrs, extra: { value: 1 } } })).toEqual(card);
  });
});
