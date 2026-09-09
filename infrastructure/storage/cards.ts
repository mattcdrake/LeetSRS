import { z } from 'zod';
import { storage } from '#imports';
import { type Card, cardSchema } from '@/domain/cards';
import { STORAGE_KEYS } from './storage-keys';

const cardsSchema = z.record(z.string(), cardSchema);

export async function getAllCards(): Promise<Card[]> {
  const cards = await storage.getItem<unknown>(STORAGE_KEYS.cards);
  return Object.values(cardsSchema.parse(cards ?? {}));
}

export async function saveCards(cards: Card[]): Promise<void> {
  await storage.setItem(STORAGE_KEYS.cards, Object.fromEntries(cards.map((card) => [card.slug, card])));
}

export function removeCards(): Promise<void> {
  return storage.removeItem(STORAGE_KEYS.cards);
}
