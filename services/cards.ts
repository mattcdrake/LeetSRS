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

async function getStorageData() {
  const [slugToCardId, cards] = await Promise.all([
    storage.getItem<Record<string, string>>(STORAGE_KEYS.slugToCardId),
    storage.getItem<Record<string, StoredCard>>(STORAGE_KEYS.cards),
  ]);

  return {
    slugToCardId: slugToCardId ?? {},
    cards: cards ?? {},
  };
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

export async function addCard(slug: string, name: string): Promise<Card> {
  const { slugToCardId, cards } = await getStorageData();

  // If the card already exists, return it
  const existingId = slugToCardId[slug];
  if (existingId) {
    const storedCard = cards[existingId];
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

export async function removeCard(slug: string): Promise<void> {
  const { slugToCardId, cards } = await getStorageData();

  const cardId = slugToCardId[slug];

  if (cardId) {
    delete cards[cardId];
  }

  delete slugToCardId[slug];

  await storage.setItems([
    { key: STORAGE_KEYS.cards, value: cards },
    { key: STORAGE_KEYS.slugToCardId, value: slugToCardId },
  ]);
}
