import type { Card } from '@/shared/cards';

const numericLeetcodeIdPattern = /^\d+$/;

const compareText = (a: string, b: string) => {
  if (a < b) return -1;
  if (a > b) return 1;
  return 0;
};

const compareCardsByLeetcodeId = (a: Card, b: Card) => {
  const aIsNumeric = numericLeetcodeIdPattern.test(a.leetcodeId);
  const bIsNumeric = numericLeetcodeIdPattern.test(b.leetcodeId);

  if (aIsNumeric && bIsNumeric) {
    const numericOrder = BigInt(a.leetcodeId) - BigInt(b.leetcodeId);
    if (numericOrder !== 0n) return numericOrder < 0n ? -1 : 1;
  } else if (aIsNumeric !== bIsNumeric) {
    // Numeric IDs sort first; nonnumeric IDs use lexical ordering below.
    return aIsNumeric ? -1 : 1;
  }

  return compareText(a.leetcodeId, b.leetcodeId) || compareText(a.id, b.id);
};

export const filterAndSortCards = (cards: readonly Card[], filterText: string) => {
  const searchLower = filterText.toLowerCase();

  return cards
    .filter(
      (card) => !filterText || card.name.toLowerCase().includes(searchLower) || card.leetcodeId.includes(filterText)
    )
    .sort(compareCardsByLeetcodeId);
};
