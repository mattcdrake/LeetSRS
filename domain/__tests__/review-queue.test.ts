import { State } from 'ts-fsrs';
import { describe, expect, it } from 'vitest';
import { createMockCard } from '@/test/utils/card-mocks';
import { buildReviewQueue, partitionDueCards } from '../review-queue';

function dueCard(slug: string, due: string, state = State.New) {
  const card = createMockCard(state, { slug });
  card.fsrs.due = new Date(due);
  return card;
}

function queueFor(cards: ReturnType<typeof dueCard>[], limit = 3, completed = 0) {
  const { reviewCards, newCards } = partitionDueCards(cards);
  return buildReviewQueue(reviewCards, newCards, limit, completed);
}

describe('review queue calculations', () => {
  it('should sort cards by due date then slug for stable ordering', () => {
    const cards = ['card-c', 'card-a', 'card-b'].map((slug) => dueCard(slug, '2024-01-15T10:00:00'));
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
    [0, ['review', 'learning', 'relearning', 'new-a', 'new-b']],
    [1, ['review', 'learning', 'relearning', 'new-a']],
    [2, ['review', 'learning', 'relearning']],
    [4, ['review', 'learning', 'relearning']],
  ])('limits only new cards after %i completions without modifying inputs', (completed, expected) => {
    const cards = [
      dueCard('new-c', '2024-01-15T12:00:00'),
      dueCard('new-b', '2024-01-15T11:00:00'),
      dueCard('new-a', '2024-01-15T11:00:00'),
      dueCard('relearning', '2024-01-15T10:00:00', State.Relearning),
      dueCard('learning', '2024-01-15T09:00:00', State.Learning),
      dueCard('review', '2024-01-15T08:00:00', State.Review),
    ];
    const before = structuredClone(cards);

    expect(queueFor(cards, 2, completed).map((card) => card.slug)).toEqual(expected);
    expect(cards).toEqual(before);
  });
});
