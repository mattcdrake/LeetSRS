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
  return { ...card, fsrs: { ...card.fsrs } };
}

export function deserializeCard(stored: StoredCard): Card {
  return {
    ...stored,
    domain: stored.domain ?? 'leetcode.com',
    fsrs: { ...stored.fsrs },
  };
}
