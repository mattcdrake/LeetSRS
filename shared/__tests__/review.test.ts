import { State } from 'ts-fsrs';
import { describe, expect, it } from 'vitest';
import { createDailyStats } from '@/background/statistics';
import type { Card } from '@/shared/models';
import { buildReviewQueue } from '@/shared/review';
import { createMockCard } from '@/test/utils/card-mocks';
import { buildLearningDocument } from '@/test/utils/learning-document-mocks';

function dueCard(slug: string, due: string, state = State.New) {
  const card = createMockCard(state, { slug });
  card.fsrs.due = new Date(due).getTime();
  return card;
}

function queueFor(cards: readonly Card[], limit = 3, completed = 0) {
  const document = buildLearningDocument({
    cards: Object.fromEntries(cards.map((card) => [card.slug, card])),
    settings: { maxNewCardsPerDay: limit },
    stats: { '2024-01-15': { ...createDailyStats(undefined), newCards: completed } },
  });
  const before = structuredClone(document);
  const queue = buildReviewQueue(document, new Date('2024-01-15T23:59:59.999'));
  expect(document).toEqual(before);
  return queue;
}

describe('review queue calculations', () => {
  it.each([State.New, State.Learning, State.Review, State.Relearning])(
    'excludes paused and future cards and includes exact due times in state %i',
    (state) => {
      const due = dueCard('due', '2024-01-15T12:00:00', state);
      const future = dueCard('future', '2024-01-15T12:00:00.001', state);
      const paused = { ...dueCard('paused', '2024-01-15T11:00:00', state), paused: true };
      const document = buildLearningDocument({ cards: { due, future, paused } });
      expect(buildReviewQueue(document, new Date('2024-01-15T12:00:00')).map((card) => card.slug)).toEqual(['due']);
    }
  );

  it('uses the default limit and restores the allowance at local midnight', () => {
    const cards = Object.fromEntries(['a', 'b', 'c', 'd'].map((slug) => [slug, dueCard(slug, '2024-01-15T12:00:00')]));
    const document = buildLearningDocument({
      cards,
      stats: { '2024-01-15': { ...createDailyStats(undefined), newCards: 3 } },
    });
    const before = structuredClone(document);
    expect(buildReviewQueue(document, new Date('2024-01-15T23:59:59.999'))).toEqual([]);
    expect(buildReviewQueue(document, new Date('2024-01-16T00:00:00')).map((card) => card.slug)).toEqual([
      'a',
      'b',
      'c',
    ]);
    expect(document).toEqual(before);
  });

  it('retains only non-new cards when the daily new-card limit is zero', () => {
    const cards = [
      dueCard('new', '2024-01-15T07:00:00'),
      dueCard('review', '2024-01-15T10:00:00', State.Review),
      dueCard('learning', '2024-01-15T08:00:00', State.Learning),
      dueCard('relearning', '2024-01-15T09:00:00', State.Relearning),
    ];

    expect(queueFor(cards, 0, 0).map((card) => card.slug)).toEqual(['learning', 'relearning', 'review']);
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
