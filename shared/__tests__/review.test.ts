import { State } from 'ts-fsrs';
import { describe, expect, it } from 'vitest';
import type { Card, LearningDocument } from '@/shared/models';
import { buildReviewCalendar, buildReviewQueue } from '@/shared/review';
import { createMockCard } from '@/test/utils/card-mocks';
import { buildLearningDocument } from '@/test/utils/learning-document-mocks';

function dueCard(frontendId: string, due: string, state = State.New) {
  const card = createMockCard(state, { frontendId });
  card.fsrs.due = new Date(due).getTime();
  return card;
}

function queueFor(cards: readonly Card[], limit = 3, completed = 0) {
  const document = buildLearningDocument({
    cards: Object.fromEntries(cards.map((card) => [card.frontendId, card])),
    settings: { maxNewCardsPerDay: limit },
    reviewActivity: { date: '2024-01-15', newCards: completed, streak: 1 },
  });
  const before = structuredClone(document);
  const queue = buildReviewQueue(document, new Date('2024-01-15T23:59:59.999'));
  expect(document).toEqual(before);
  return queue;
}

describe('review queue calculations', () => {
  it.each([State.New, State.Review])(
    'excludes paused and future cards and includes exact due times in state %i',
    (state) => {
      const due = dueCard('due', '2024-01-15T12:00:00', state);
      const future = dueCard('future', '2024-01-15T12:00:00.001', state);
      const paused = { ...dueCard('paused', '2024-01-15T11:00:00', state), paused: true };
      const document = buildLearningDocument({ cards: { due, future, paused } });
      expect(buildReviewQueue(document, new Date('2024-01-15T12:00:00')).map((card) => card.frontendId)).toEqual([
        'due',
      ]);
    }
  );

  it('uses the default limit and restores the allowance at local midnight', () => {
    const cards = Object.fromEntries(['a', 'b', 'c', 'd'].map((slug) => [slug, dueCard(slug, '2024-01-15T12:00:00')]));
    const document = buildLearningDocument({
      cards,
      reviewActivity: { date: '2024-01-15', newCards: 3, streak: 1 },
    });
    const before = structuredClone(document);
    expect(buildReviewQueue(document, new Date('2024-01-15T23:59:59.999'))).toEqual([]);
    expect(buildReviewQueue(document, new Date('2024-01-16T00:00:00')).map((card) => card.frontendId)).toEqual([
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

    expect(queueFor(cards, 0, 0).map((card) => card.frontendId)).toEqual(['learning', 'relearning', 'review']);
  });

  it.each([
    [0, ['review', 'new-b', 'new-a', 'learning', 'relearning']],
    [1, ['review', 'new-b', 'learning', 'relearning']],
    [2, ['review', 'learning', 'relearning']],
    [4, ['review', 'learning', 'relearning']],
  ])('limits only new cards after %i completions without modifying inputs', (completed, expected) => {
    const cards: readonly Card[] = Object.freeze([
      dueCard('new-c', '2024-01-15T11:00:00.001'),
      dueCard('new-b', '2024-01-15T11:00:00'),
      dueCard('new-a', '2024-01-15T11:00:00'),
      dueCard('relearning', '2024-01-15T13:00:00', State.Relearning),
      dueCard('learning', '2024-01-15T11:30:00', State.Learning),
      dueCard('review', '2024-01-15T08:00:00', State.Review),
    ]);
    const before = structuredClone(cards);

    expect(queueFor(cards, 2, completed).map((card) => card.frontendId)).toEqual(expected);
    expect(cards).toEqual(before);
  });
});

function calendarFor(cards: Card[], now: string, overrides: Partial<LearningDocument> = {}) {
  const document = buildLearningDocument({
    ...overrides,
    cards: Object.fromEntries(cards.map((card) => [card.frontendId, card])),
  });
  const before = structuredClone(document);
  const calendar = buildReviewCalendar(document, new Date(now));
  expect(document).toEqual(before);
  for (const day of Object.values(calendar)) expect(day.count).toBe(day.cards.length);
  return calendar;
}

describe('review calendar calculations', () => {
  it('groups overdue cards under today, excludes paused cards, and preserves queue ordering', () => {
    const cards = [
      dueCard('late', '2024-01-16T07:59:59.999Z', State.Review),
      dueCard('new-b', '2024-01-14T09:00:00'),
      dueCard('new-a', '2024-01-14T09:00:00'),
      dueCard('review', '2024-01-13T08:00:00', State.Review),
      dueCard('learning', '2024-01-15T00:00:00', State.Learning),
      dueCard('relearning', '2024-01-15T09:00:00', State.Relearning),
      { ...dueCard('paused-new', '2024-01-12T08:00:00'), paused: true },
      { ...dueCard('paused-review', '2024-01-14T08:00:00', State.Review), paused: true },
      dueCard('at-midnight', '2024-01-16T08:00:00Z', State.Review),
    ];
    const calendar = calendarFor(cards, '2024-01-15T12:00:00');
    expect(Object.keys(calendar)).toEqual(['2024-01-15', '2024-01-16']);
    expect(calendar['2024-01-15']).toEqual({
      cards: [cards[3], cards[1], cards[2], cards[4], cards[5], cards[0]],
      count: 6,
      overdueCount: 3,
    });
    expect(calendar['2024-01-16']).toEqual({ cards: [cards[8]], count: 1, overdueCount: 0 });
    const document = buildLearningDocument({ cards: Object.fromEntries(cards.map((card) => [card.frontendId, card])) });
    expect(calendar['2024-01-15'].cards).toEqual(buildReviewQueue(document, new Date('2024-01-15T23:59:59.999')));
  });

  it.each([
    [1, ['overdue-review', 'new-a'], ['new-b', 'new-c', 'review'], ['future-new'], 2],
    [2, ['overdue-review'], ['new-a', 'new-b', 'review'], ['new-c', 'future-new'], 1],
    [4, ['overdue-review'], ['new-a', 'new-b', 'review'], ['new-c', 'future-new'], 1],
  ])(
    'projects remaining allowances across months after %i completions',
    (completed, today, tomorrow, later, overdue) => {
      const cards = [
        dueCard('future-new', '2024-02-01T10:00:00'),
        dueCard('new-c', '2024-01-31T10:00:00'),
        dueCard('review', '2024-02-01T00:00:00', State.Review),
        dueCard('new-b', '2024-01-30T10:00:00'),
        dueCard('new-a', '2024-01-29T10:00:00'),
        dueCard('distant', '2024-03-10T10:00:00'),
        dueCard('overdue-review', '2024-01-28T10:00:00', State.Review),
      ];
      const calendar = calendarFor(cards, '2024-01-31T12:00:00', {
        settings: { maxNewCardsPerDay: 2 },
        reviewActivity: { date: '2024-01-31', newCards: completed, streak: 1 },
      });
      expect(
        Object.fromEntries(
          Object.entries(calendar).map(([date, day]) => [date, day.cards.map((card) => card.frontendId)])
        )
      ).toEqual({
        '2024-01-31': today,
        '2024-02-01': tomorrow,
        '2024-02-02': later,
        '2024-03-10': ['distant'],
      });
      expect(Object.values(calendar).map((day) => day.overdueCount)).toEqual([overdue, 0, 0, 0]);
    }
  );

  it('restores the default allowance after local midnight', () => {
    const cards = ['a', 'b', 'c', 'd'].map((id) => dueCard(id, '2024-01-15T10:00:00'));
    expect(
      calendarFor(cards, '2024-01-16T00:00:00', {
        reviewActivity: { date: '2024-01-15', newCards: 3, streak: 1 },
      })
    ).toEqual({
      '2024-01-16': { cards: cards.slice(0, 3), count: 3, overdueCount: 3 },
      '2024-01-17': { cards: [cards[3]], count: 1, overdueCount: 0 },
    });
  });

  it('omits new cards entirely at a zero limit while retaining all non-new states', () => {
    const cards = [
      dueCard('new', '2024-01-14T10:00:00'),
      dueCard('future-new', '2024-01-17T10:00:00'),
      dueCard('learning', '2024-01-14T11:00:00', State.Learning),
      dueCard('relearning', '2024-01-15T12:00:00', State.Relearning),
      dueCard('review', '2024-01-16T11:00:00', State.Review),
    ];
    expect(calendarFor(cards, '2024-01-15T12:00:00', { settings: { maxNewCardsPerDay: 0 } })).toEqual({
      '2024-01-15': { cards: [cards[2], cards[3]], count: 2, overdueCount: 1 },
      '2024-01-16': { cards: [cards[4]], count: 1, overdueCount: 0 },
    });
  });

  it.each([
    ['2024-03-09', ['2024-03-09', '2024-03-10', '2024-03-11']],
    ['2024-11-02', ['2024-11-02', '2024-11-03', '2024-11-04']],
  ])('carries new cards through daylight saving changes starting %s', (start, days) => {
    const cards = ['a', 'b', 'c'].map((id) => dueCard(id, `${start}T10:00:00`));
    const calendar = calendarFor(cards, `${start}T12:00:00`, { settings: { maxNewCardsPerDay: 1 } });
    expect(Object.keys(calendar)).toEqual(days);
    expect(Object.values(calendar).map((day) => day.cards)).toEqual(cards.map((card) => [card]));
  });

  it('returns no populated days when there are no eligible cards', () => {
    expect(calendarFor([], '2024-01-15T12:00:00')).toEqual({});
    expect(calendarFor([{ ...dueCard('paused', '2024-01-15T10:00:00'), paused: true }], '2024-01-15T12:00:00')).toEqual(
      {}
    );
  });
});
