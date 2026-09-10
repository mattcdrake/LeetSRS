import { State } from 'ts-fsrs';
import { describe, expect, it } from 'vitest';
import type { Card } from '@/domain/cards';
import { createMockCard } from '@/test/utils/card-mocks';
import { buildReviewQueue, calculateDelayedDueDate, isDue } from '../review';

describe('isDue', () => {
  it.each([
    ['2024-01-14T10:00:00', true],
    ['2024-01-15T00:00:00', true],
    ['2024-01-15T14:29:59.999', true],
    ['2024-01-15T14:30:00.000', true],
    ['2024-01-15T14:30:00.001', false],
    ['2024-01-15T23:59:59.999', false],
    ['2024-01-16T00:00:00', false],
  ])('checks due timestamp %s against the current time', (due, expected) => {
    const card = dueCard('card', due, State.Review);
    expect(isDue(card, new Date('2024-01-15T14:30:00'))).toBe(expected);
  });

  it.each([State.New, State.Learning, State.Review, State.Relearning])(
    'waits for the exact due timestamp in state %s',
    (state) => {
      const card = dueCard('card', '2024-01-15T23:59:59.999', state);
      expect(isDue(card, new Date('2024-01-15T23:59:59.998'))).toBe(false);
      expect(isDue(card, new Date('2024-01-15T23:59:59.999'))).toBe(true);
    }
  );
});

function dueCard(slug: string, due: string, state = State.New) {
  const card = createMockCard(state, { slug });
  card.fsrs.due = new Date(due).getTime();
  return card;
}

function queueFor(cards: readonly Card[], limit = 3, completed = 0) {
  return buildReviewQueue(cards, limit, completed);
}

describe('review queue calculations', () => {
  it('returns an empty queue for an empty readonly collection', () => {
    expect(buildReviewQueue(Object.freeze([]), 3, 0)).toEqual([]);
  });

  it('retains only non-new cards when the daily new-card limit is zero', () => {
    const cards = [
      dueCard('new', '2024-01-15T07:00:00'),
      dueCard('review', '2024-01-15T10:00:00', State.Review),
      dueCard('learning', '2024-01-15T08:00:00', State.Learning),
      dueCard('relearning', '2024-01-15T09:00:00', State.Relearning),
    ];

    expect(buildReviewQueue(cards, 0, 0).map((card) => card.slug)).toEqual(['learning', 'relearning', 'review']);
  });

  it.each([0, 1705312800000])('sorts equal due timestamps %i by slug', (timestamp) => {
    const cards = ['card-c', 'card-a', 'card-b'].map((slug) => {
      const card = createMockCard(State.New, { slug });
      card.fsrs.due = timestamp;
      return card;
    });
    const queue = queueFor(cards);

    expect(queue[0].slug).toBe('card-a');
    expect(queue[1].slug).toBe('card-b');
    expect(queue[2].slug).toBe('card-c');
  });

  it('should properly sort by due date timestamps', () => {
    const queue = queueFor([
      dueCard('late', '2024-01-15T18:00:00'),
      dueCard('early', '2024-01-15T06:00:00'),
      dueCard('middle', '2024-01-15T12:00:00'),
    ]);

    expect(queue[0].slug).toBe('early');
    expect(queue[1].slug).toBe('middle');
    expect(queue[2].slug).toBe('late');
  });

  it('should handle cards with millisecond-precision due times', () => {
    const queue = queueFor([
      dueCard('card-a', '2024-01-15T10:00:00.100'),
      dueCard('card-b', '2024-01-15T10:00:00.050'),
      dueCard('card-c', '2024-01-15T10:00:00.150'),
    ]);

    expect(queue[0].slug).toBe('card-b');
    expect(queue[1].slug).toBe('card-a');
    expect(queue[2].slug).toBe('card-c');
  });

  it.each([
    [0, ['review', 'new-a', 'new-b', 'learning', 'relearning']],
    [1, ['review', 'new-a', 'learning', 'relearning']],
    [2, ['review', 'learning', 'relearning']],
    [4, ['review', 'learning', 'relearning']],
  ])('limits only new cards after %i completions without modifying inputs', (completed, expected) => {
    const cards: readonly Card[] = Object.freeze([
      dueCard('new-c', '2024-01-15T12:00:00'),
      dueCard('new-b', '2024-01-15T11:00:00'),
      dueCard('new-a', '2024-01-15T11:00:00'),
      dueCard('relearning', '2024-01-15T13:00:00', State.Relearning),
      dueCard('learning', '2024-01-15T11:30:00', State.Learning),
      dueCard('review', '2024-01-15T08:00:00', State.Review),
    ]);
    const before = structuredClone(cards);

    expect(queueFor(cards, 2, completed).map((card) => card.slug)).toEqual(expected);
    expect(cards).toEqual(before);
  });
});

describe('delayed due date', () => {
  it.each([
    ['2024-01-31T10:30:00', 1, '2024-02-01T10:30:00'],
    ['2024-02-28T10:30:00', 1, '2024-02-29T10:30:00'],
    ['2024-12-31T10:30:00', 1, '2025-01-01T10:30:00'],
    ['2024-03-09T10:30:00', 1, '2024-03-10T10:30:00'],
    ['2024-11-02T10:30:00', 1, '2024-11-03T10:30:00'],
    ['2024-03-15T10:30:00', 0, '2024-03-15T10:30:00'],
    ['2024-03-15T10:30:00', -1, '2024-03-14T10:30:00'],
  ])('shifts %s by %i local calendar days', (input, days, expected) => {
    const due = new Date(input).getTime();
    const result = calculateDelayedDueDate(due, days);

    expect(result).toBe(new Date(expected).getTime());
  });
});
