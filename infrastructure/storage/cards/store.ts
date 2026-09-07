import { storage } from '#imports';
import type { Card } from '@/domain/cards';
import { STORAGE_KEYS } from '../storage-keys';
import { deserializeCard, type StoredCard, serializeCard } from './codec';

async function getCards(): Promise<Record<string, StoredCard>> {
  const cards = await storage.getItem<Record<string, StoredCard>>(STORAGE_KEYS.cards);
  return cards ?? {};
}

// Retain the loaded record for each read-modify-write workflow. Decode only
// requested cards so unrelated legacy records are preserved verbatim.
export async function loadCardStore() {
  const cards = await getCards();
  return {
    has: (slug: string): boolean => slug in cards,
    get: (slug: string): Card => deserializeCard(cards[slug]),
    getReference: (slug: string): Pick<Card, 'id'> | undefined => cards[slug] && { id: cards[slug].id },
    async save(slug: string, card: Card): Promise<void> {
      cards[slug] = serializeCard(card);
      await storage.setItem(STORAGE_KEYS.cards, cards);
    },
    async remove(slug: string): Promise<void> {
      delete cards[slug];
      await storage.setItem(STORAGE_KEYS.cards, cards);
    },
  };
}

export async function getAllCards(): Promise<Card[]> {
  const cards = await getCards();
  return Object.values(cards).map(deserializeCard);
}
