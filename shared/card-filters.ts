import { State } from 'ts-fsrs';
import { isDue } from './calendar';
import type { Card } from './learning-document';

export const CARD_FILTERS = ['due', 'new', 'paused'] as const;
export type CardFilter = (typeof CARD_FILTERS)[number];

export function matchesCardFilters(card: Card, filters: readonly CardFilter[], now: number): boolean {
  const matches: Record<CardFilter, boolean> = {
    due: isDue(card.fsrs.due, new Date(now)),
    new: card.fsrs.state === State.New,
    paused: card.paused,
  };
  return filters.every((filter) => matches[filter]);
}
