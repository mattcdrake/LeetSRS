import { State } from 'ts-fsrs';
import { describe, expect, it } from 'vitest';
import type { CardWithProblem } from '@/popup/queries/cards';
import { createMockCardWithProblem } from '@/test/utils/card-mocks';
import { filterAndSortCards, groupCardsByDue } from '../card-list';

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
    expect(getIds(filterAndSortCards(cards, '', [], Date.now(), 'id'))).toEqual(expectedIds);
  });

  it('sorts by due date or most recently added, breaking ties by ID', () => {
    const cards = (
      [
        ['late', '1', '2024-01-20T09:00:00', 3],
        ['tie-b', '20', '2024-01-16T09:00:00', 1],
        ['tie-a', '3', '2024-01-16T09:00:00', 2],
      ] as const
    ).map(([id, frontendId, due, createdAt]) => {
      const card = createCard(id, frontendId);
      card.fsrs.due = new Date(due).getTime();
      card.createdAt = createdAt;
      return card;
    });
    expect(getIds(filterAndSortCards(cards, '', [], Date.now(), 'due'))).toEqual(['tie-a', 'tie-b', 'late']);
    expect(getIds(filterAndSortCards(cards, '', [], Date.now(), 'added'))).toEqual(['late', 'tie-a', 'tie-b']);
  });
});

describe('groupCardsByDue', () => {
  it('buckets by local due day, puts paused cards last and omits empty groups', () => {
    const now = new Date('2024-03-09T10:00:00').getTime();
    const cards = (
      [
        ['overdue', '2024-03-08T23:59:59.999', false],
        ['today-early', '2024-03-09T00:00:00', false],
        ['today-late', '2024-03-09T23:59:59.999', false],
        // Seven local days ahead across the spring DST change.
        ['week', '2024-03-16T23:00:00', false],
        ['later', '2024-03-17T00:00:00', false],
        ['paused', '2024-03-01T00:00:00', true],
      ] as const
    ).map(([id, due, paused]) => {
      const card = createCard(id, id);
      card.fsrs.due = new Date(due).getTime();
      card.paused = paused;
      return card;
    });
    const groups = groupCardsByDue(cards, now);
    expect(groups.map((group) => [group.id, getIds(group.cards)])).toEqual([
      ['overdue', ['overdue']],
      ['today', ['today-early', 'today-late']],
      ['week', ['week']],
      ['later', ['later']],
      ['paused', ['paused']],
    ]);
    expect(groupCardsByDue(cards.slice(1, 3), now).map((group) => group.id)).toEqual(['today']);
  });
});
