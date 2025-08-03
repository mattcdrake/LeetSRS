import { STORAGE_KEYS } from './storage-keys';
import { storage } from '#imports';

export interface Card {
  id: string;
  slug: string;
  name: string;
  createdAt: Date;
}

export interface StoredCard extends Omit<Card, 'createdAt'> {
  createdAt: number;
}

export async function addCard(slug: string, name: string): Promise<Card> {
  // If the card already exists, return it
  const slugToCardId = (await storage.getItem<Record<string, string>>(STORAGE_KEYS.slugToCardId)) ?? {};
  if (slugToCardId[slug]) {
    const cards = (await storage.getItem<Record<string, StoredCard>>(STORAGE_KEYS.cards)) ?? {};
    const storedCard = cards[slugToCardId[slug]];
    if (storedCard) {
      return deserializeCard(storedCard);
    }
  }

  // Create new card
  const card: Card = {
    id: crypto.randomUUID(),
    slug,
    name,
    createdAt: new Date(),
  };

  // Save card and update slug to ID mapping
  const cards = (await storage.getItem<Record<string, StoredCard>>(STORAGE_KEYS.cards)) ?? {};
  cards[card.id] = serializeCard(card);
  slugToCardId[slug] = card.id;

  await storage.setItems([
    { key: STORAGE_KEYS.cards, value: cards },
    { key: STORAGE_KEYS.slugToCardId, value: slugToCardId },
  ]);

  return card;
}

export async function getAllCards(): Promise<Card[]> {
  const cards = (await storage.getItem<Record<string, StoredCard>>(STORAGE_KEYS.cards)) ?? {};
  return Object.values(cards).map(deserializeCard);
}

export function serializeCard(card: Card): StoredCard {
  return {
    ...card,
    createdAt: card.createdAt.getTime(),
  };
}

export function deserializeCard(stored: StoredCard): Card {
  return {
    ...stored,
    createdAt: new Date(stored.createdAt),
  };
}
