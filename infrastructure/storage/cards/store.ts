import { storage } from '#imports';
import type { Card } from '@/domain/cards';
import { STORAGE_KEYS } from '../storage-keys';
import { deserializeCard, type StoredCard, serializeCard } from './codec';

export async function getAllCards(): Promise<Card[]> {
  const cards = await storage.getItem<Record<string, StoredCard>>(STORAGE_KEYS.cards);
  return Object.values(cards ?? {}).map(deserializeCard);
}

export async function saveCards(cards: Card[]): Promise<void> {
  await storage.setItem(STORAGE_KEYS.cards, Object.fromEntries(cards.map((card) => [card.slug, serializeCard(card)])));
}
