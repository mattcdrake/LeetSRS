import { State } from 'ts-fsrs';
import { isDue } from './calendar';
import type { Card } from './models';

export type CardFilter = 'due' | 'new' | 'paused';

export function matchesCardFilters(card: Card, filters: readonly CardFilter[], now: number): boolean {
  const matches: Record<CardFilter, boolean> = {
    due: isDue(card.fsrs.due, new Date(now)),
    new: card.fsrs.state === State.New,
    paused: card.paused,
  };
  return filters.every((filter) => matches[filter]);
}
