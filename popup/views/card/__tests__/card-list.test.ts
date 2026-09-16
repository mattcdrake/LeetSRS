import { State } from 'ts-fsrs';
import { describe, expect, it } from 'vitest';
import type { CardWithProblem } from '@/popup/queries/cards';
import { createMockCardWithProblem } from '@/test/utils/card-mocks';
import { filterAndSortCards } from '../card-list';

const createCard = (id: string, frontendId: string, title = id): CardWithProblem =>
  createMockCardWithProblem(State.New, { frontendId, title, slug: id });

const getIds = (cards: CardWithProblem[]) => cards.map((card) => card.slug);

describe('filterAndSortCards', () => {
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
