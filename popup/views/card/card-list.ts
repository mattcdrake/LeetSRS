import type { CardWithProblem } from '@/popup/queries/cards';
import { getProblemTitle } from '@/shared/ui/problem-title';

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

export const filterAndSortCards = (cards: readonly CardWithProblem[], filterText: string) => {
  const searchLower = filterText.toLowerCase();

  return cards
    .filter(
      (card) =>
        !filterText ||
        getProblemTitle(card, card.domain).toLowerCase().includes(searchLower) ||
        card.frontendId.includes(filterText)
    )
    .sort(compareCardsByLeetcodeId);
};
