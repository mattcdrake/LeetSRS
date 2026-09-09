import { storage } from '#imports';
import type { Card } from '@/domain/cards';
import { STORAGE_KEYS } from './storage-keys';

export async function getAllCards(): Promise<Card[]> {
  const cards = await storage.getItem<Record<string, Card>>(STORAGE_KEYS.cards);
  return Object.values(cards ?? {});
}

export async function saveCards(cards: Card[]): Promise<void> {
  await storage.setItem(STORAGE_KEYS.cards, Object.fromEntries(cards.map((card) => [card.slug, card])));
}

export function removeCards(): Promise<void> {
  return storage.removeItem(STORAGE_KEYS.cards);
}
