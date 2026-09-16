import { State } from 'ts-fsrs';
import { describe, expect, it } from 'vitest';
import type { CardWithProblem } from '@/popup/queries/cards';
import type { CardFilter } from '@/shared/card-filters';
import { createMockCardWithProblem } from '@/test/utils/card-mocks';
import { filterAndSortCards } from '../card-list';

const createCard = (id: string, frontendId: string, title = id): CardWithProblem =>
  createMockCardWithProblem(State.New, { frontendId, title, slug: id });

const getIds = (cards: CardWithProblem[]) => cards.map((card) => card.slug);

describe('filterAndSortCards', () => {
  const now = Date.parse('2026-09-16T12:00:00Z');
  const filterCards = (
    [
      ['active-new-due', State.New, false, now - 1],
      ['paused-new-due', State.New, true, now],
      ['active-practiced-due', State.Review, false, now],
      ['paused-practiced-due', State.Review, true, now],
      ['active-new-future', State.New, false, now + 1],
      ['paused-new-future', State.New, true, now + 1],
      ['active-practiced-future', State.Review, false, now + 1],
      ['paused-practiced-future', State.Review, true, now + 1],
    ] as const
  ).map(([slug, state, paused, due], index) => {
    const card = createMockCardWithProblem(state, {
      frontendId: String(index + 1),
      slug,
      title: slug,
      paused,
    });
    return { ...card, fsrs: { ...card.fsrs, due, reps: state === State.New ? 0 : 1 } };
  });

  it.each<{ filters: CardFilter[]; expected: string[] }>([
    { filters: [], expected: filterCards.map((card) => card.slug) },
    {
      filters: ['due'],
      expected: ['active-new-due', 'paused-new-due', 'active-practiced-due', 'paused-practiced-due'],
    },
    { filters: ['new'], expected: ['active-new-due', 'paused-new-due', 'active-new-future', 'paused-new-future'] },
    {
      filters: ['paused'],
      expected: ['paused-new-due', 'paused-practiced-due', 'paused-new-future', 'paused-practiced-future'],
    },
    { filters: ['due', 'new'], expected: ['active-new-due', 'paused-new-due'] },
    { filters: ['due', 'paused'], expected: ['paused-new-due', 'paused-practiced-due'] },
    { filters: ['new', 'paused'], expected: ['paused-new-due', 'paused-new-future'] },
    { filters: ['due', 'new', 'paused'], expected: ['paused-new-due'] },
  ])('intersects $filters using exact timestamps and independent pause status', ({ filters, expected }) => {
    expect(getIds(filterAndSortCards(filterCards, '', filters, now))).toEqual(expected);
  });

  it.each([State.Learning, State.Review, State.Relearning])('excludes practiced state %s from New', (state) => {
    expect(filterAndSortCards([createMockCardWithProblem(state)], '', ['new'], now)).toEqual([]);
  });

  it('combines selected filters with search and preserves ID sorting', () => {
    expect(getIds(filterAndSortCards([...filterCards].reverse(), 'future', ['new'], now))).toEqual([
      'active-new-future',
      'paused-new-future',
    ]);
  });

  it('does not mutate the input', () => {
    const cards = [createCard('second', '2'), createCard('first', '1')];

    filterAndSortCards(cards, '');

    expect(getIds(cards)).toEqual(['second', 'first']);
  });

  it.each([
    {
      description: 'returns every card for an empty filter',
      cards: [createCard('second', '2'), createCard('first', '1')],
      filterText: '',
      expectedIds: ['first', 'second'],
    },
    {
      description: 'filters names case-insensitively',
      cards: [createCard('match', '2', 'Add TWO Numbers'), createCard('other', '1', 'Two Sum')],
      filterText: 'two numbers',
      expectedIds: ['match'],
    },
    {
      description: 'filters by an ID substring',
      cards: [createCard('first', '123'), createCard('match', '456'), createCard('last', '789')],
      filterText: '45',
      expectedIds: ['match'],
    },
  ])('$description', ({ cards, filterText, expectedIds }) => {
    expect(getIds(filterAndSortCards(cards, filterText))).toEqual(expectedIds);
  });

  it.each([
    {
      description: 'sorts fully numeric IDs numerically without number precision limits',
      cards: [
        createCard('large', '9007199254740993'),
        createCard('hundred', '100'),
        createCard('two', '2'),
        createCard('safe-limit', '9007199254740992'),
      ],
      expectedIds: ['two', 'hundred', 'safe-limit', 'large'],
    },
    {
      description: 'orders equal numeric IDs by their original text',
      cards: [createCard('b', '1'), createCard('c', '01'), createCard('d', '001')],
      expectedIds: ['d', 'c', 'b'],
    },
    {
      description: 'places nonnumeric IDs after numeric IDs in deterministic lexical order',
      cards: [
        createCard('x-second', 'x'),
        createCard('contest', 'contest-2'),
        createCard('numeric', '10'),
        createCard('alpha', 'A'),
      ],
      expectedIds: ['numeric', 'alpha', 'contest', 'x-second'],
    },
  ])('$description', ({ cards, expectedIds }) => {
    expect(getIds(filterAndSortCards(cards, ''))).toEqual(expectedIds);
  });
});
