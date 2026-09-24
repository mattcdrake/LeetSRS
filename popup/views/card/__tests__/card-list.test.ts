import { State } from 'ts-fsrs';
import { describe, expect, it } from 'vitest';
import type { CardWithProblem } from '@/popup/queries/cards';
import { createMockCardWithProblem } from '@/test/utils/card-mocks';
import { filterAndSortCards } from '../card-list';

const createCard = (id: string, frontendId: string, title = id): CardWithProblem =>
  createMockCardWithProblem(State.New, { frontendId, title, slug: id });

const getIds = (cards: CardWithProblem[]) => cards.map((card) => card.slug);

describe('filterAndSortCards', () => {
  it('filters by local due day while preserving combined filters', () => {
    const cards = (
      [
        ['1', '2024-01-14T12:00:00', false],
        ['2', '2024-01-15T23:59:59.999', false],
        ['3', '2024-01-16T00:00:00', false],
        ['4', '2024-01-15T23:59:59.999', true],
      ] as const
    ).map(([id, due, paused]) => {
      const card = createCard(id, id);
      card.fsrs.due = new Date(due).getTime();
      card.paused = paused;
      return card;
    });
    const now = new Date('2024-01-15T10:00:00').getTime();
    expect(getIds(filterAndSortCards(cards, '', ['due'], now))).toEqual(['1', '2', '4']);
    expect(getIds(filterAndSortCards(cards, '', ['due', 'paused'], now))).toEqual(['4']);
  });

  it('searches IDs and displayed titles case-insensitively', () => {
    const cards = [
      createCard('two-sum', '1', 'Two Sum'),
      createCard('add-two-numbers', '2', 'Add Two Numbers'),
      { ...createCard('cn', '3', 'Longest Substring'), domain: 'leetcode.cn' as const, translatedTitle: '最长子串' },
    ];
    expect(getIds(filterAndSortCards(cards, 'tWo SuM'))).toEqual(['two-sum']);
    expect(getIds(filterAndSortCards(cards, '2'))).toEqual(['add-two-numbers']);
    expect(getIds(filterAndSortCards(cards, '子串'))).toEqual(['cn']);
    expect(getIds(filterAndSortCards(cards, 'missing'))).toEqual([]);
  });

  it.each([
    {
      description: 'sorts numeric IDs numerically rather than lexically',
      cards: [createCard('hundred', '100'), createCard('two', '2'), createCard('ten', '10')],
      expectedIds: ['two', 'ten', 'hundred'],
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
