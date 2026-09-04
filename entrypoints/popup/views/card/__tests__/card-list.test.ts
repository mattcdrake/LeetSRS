import { State } from 'ts-fsrs';
import { describe, expect, it } from 'vitest';
import type { Card } from '@/shared/cards';
import { createMockCard } from '@/test/utils/card-mocks';
import { filterAndSortCards } from '../card-list';

const createCard = (id: string, leetcodeId: string, name = id): Card =>
  createMockCard(State.New, { id, leetcodeId, name });

const getIds = (cards: Card[]) => cards.map((card) => card.id);

describe('filterAndSortCards', () => {
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
      description: 'orders equal numeric IDs by their original text and then card ID',
      cards: [createCard('b', '1'), createCard('c', '01'), createCard('a', '1'), createCard('d', '001')],
      expectedIds: ['d', 'c', 'a', 'b'],
    },
    {
      description: 'places nonnumeric IDs after numeric IDs in deterministic lexical order',
      cards: [
        createCard('x-second', 'x'),
        createCard('contest', 'contest-2'),
        createCard('numeric', '10'),
        createCard('x-first', 'x'),
        createCard('alpha', 'A'),
      ],
      expectedIds: ['numeric', 'alpha', 'contest', 'x-first', 'x-second'],
    },
  ])('$description', ({ cards, expectedIds }) => {
    expect(getIds(filterAndSortCards(cards, ''))).toEqual(expectedIds);
  });
});
