import type { CardWithProblem } from '@/popup/queries/cards';
import { localDaysUntil } from '@/shared/calendar';
import { CARD_FILTERS, type CardFilter, matchesCardFilters } from '@/shared/card-filters';
import { getProblemTitle } from '@/shared/ui/problem-title';

export const CARD_SORTS = ['due', 'id', 'added'] as const;
export type CardSort = (typeof CARD_SORTS)[number];

export type CardGroupId = 'overdue' | 'today' | 'week' | 'later' | 'paused';

export interface CardGroup {
  id: CardGroupId;
  cards: CardWithProblem[];
}

const numericLeetcodeIdPattern = /^\d+$/;

const compareText = (a: string, b: string) => {
  if (a < b) return -1;
  if (a > b) return 1;
  return 0;
};

const compareCardsByLeetcodeId = (a: CardWithProblem, b: CardWithProblem) => {
  const aIsNumeric = numericLeetcodeIdPattern.test(a.frontendId);
  const bIsNumeric = numericLeetcodeIdPattern.test(b.frontendId);

  if (aIsNumeric && bIsNumeric) {
    const numericOrder = BigInt(a.frontendId) - BigInt(b.frontendId);
    if (numericOrder !== 0n) return numericOrder < 0n ? -1 : 1;
  } else if (aIsNumeric !== bIsNumeric) {
    // Numeric IDs sort first; nonnumeric IDs use lexical ordering below.
    return aIsNumeric ? -1 : 1;
  }

  return compareText(a.frontendId, b.frontendId);
};

const comparators: Record<CardSort, (a: CardWithProblem, b: CardWithProblem) => number> = {
  due: (a, b) => a.fsrs.due - b.fsrs.due || compareCardsByLeetcodeId(a, b),
  id: compareCardsByLeetcodeId,
  added: (a, b) => b.createdAt - a.createdAt || compareCardsByLeetcodeId(a, b),
};

export const filterAndSortCards = (
  cards: readonly CardWithProblem[],
  filterText: string,
  filters: readonly CardFilter[] = [],
  now = Date.now(),
  sort: CardSort = 'due'
) => {
  const searchLower = filterText.toLowerCase();

  return cards
    .filter((card) => matchesCardFilters(card, filters, now))
    .filter(
      (card) =>
        !filterText ||
        getProblemTitle(card, card.domain).toLowerCase().includes(searchLower) ||
        card.frontendId.includes(filterText)
    )
    .sort(comparators[sort]);
};

/** Counts each filter over all cards, independent of the other filters. */
export const countCardFilters = (cards: readonly CardWithProblem[], now: number) =>
  Object.fromEntries(
    CARD_FILTERS.map((filter) => [filter, cards.filter((card) => matchesCardFilters(card, [filter], now)).length])
  ) as Record<CardFilter, number>;

const getGroupId = (card: CardWithProblem, now: Date): CardGroupId => {
  if (card.paused) return 'paused';
  const days = localDaysUntil(card.fsrs.due, now);
  if (days < 0) return 'overdue';
  if (days === 0) return 'today';
  return days <= 7 ? 'week' : 'later';
};

const GROUP_ORDER: readonly CardGroupId[] = ['overdue', 'today', 'week', 'later', 'paused'];

/** Groups cards by local due day, keeping their order; paused cards go last. Empty groups are omitted. */
export const groupCardsByDue = (cards: readonly CardWithProblem[], now: number): CardGroup[] => {
  const today = new Date(now);
  const groups = new Map<CardGroupId, CardWithProblem[]>(GROUP_ORDER.map((id) => [id, []]));
  for (const card of cards) groups.get(getGroupId(card, today))?.push(card);
  return GROUP_ORDER.map((id) => ({ id, cards: groups.get(id) ?? [] })).filter((group) => group.cards.length > 0);
};
