import type { Card as FsrsCard } from 'ts-fsrs';
import type { Card } from '@/domain/cards';

export interface StoredCard extends Omit<Card, 'createdAt' | 'fsrs' | 'domain'> {
  domain?: Card['domain'];
  createdAt: number;
  fsrs: Omit<FsrsCard, 'due' | 'last_review'> & {
    due: number;
    last_review?: number;
  };
}

export function serializeCard(card: Card): StoredCard {
  return {
    ...card,
    createdAt: card.createdAt.getTime(),
    fsrs: {
      ...card.fsrs,
      due: card.fsrs.due.getTime(),
      last_review: card.fsrs.last_review?.getTime(),
    },
  };
}

export function deserializeCard(stored: StoredCard): Card {
  return {
    ...stored,
    domain: stored.domain ?? 'leetcode.com',
    createdAt: new Date(stored.createdAt),
    fsrs: {
      ...stored.fsrs,
      due: new Date(stored.fsrs.due),
      last_review: stored.fsrs.last_review === undefined ? undefined : new Date(stored.fsrs.last_review),
    },
  };
}
