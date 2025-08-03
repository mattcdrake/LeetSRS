import { type Card as FsrsCard, createEmptyCard } from 'ts-fsrs';
import { STORAGE_KEYS } from './storage-keys';
import { storage } from '#imports';

export interface Card {
  slug: string;
  name: string;
  createdAt: Date;
  fsrs: FsrsCard;
}

export interface StoredCard extends Omit<Card, 'createdAt' | 'fsrs'> {
  createdAt: number;
  fsrs: Omit<FsrsCard, 'due' | 'last_review'> & {
    due: number;
    last_review?: number;
  };
}

async function getCards(): Promise<Record<string, StoredCard>> {
  const cards = await storage.getItem<Record<string, StoredCard>>(STORAGE_KEYS.cards);
  return cards ?? {};
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
  const { due, last_review, ...rest } = stored.fsrs;
  return {
    ...stored,
    createdAt: new Date(stored.createdAt),
    fsrs: {
      ...rest,
      due: new Date(due),
      last_review: last_review ? new Date(last_review) : undefined,
    },
  };
}

export async function addCard(slug: string, name: string): Promise<Card> {
  const cards = await getCards();
  if (slug in cards) {
    return deserializeCard(cards[slug]);
  }

  const card: Card = {
    slug,
    name,
    createdAt: new Date(),
    fsrs: createEmptyCard(),
  };

  cards[slug] = serializeCard(card);
  await storage.setItem(STORAGE_KEYS.cards, cards);
  return card;
}

export async function getAllCards(): Promise<Card[]> {
  const cards = await getCards();
  return Object.values(cards).map(deserializeCard);
}

export async function removeCard(slug: string): Promise<void> {
  const cards = await getCards();
  delete cards[slug];
  await storage.setItem(STORAGE_KEYS.cards, cards);
}
