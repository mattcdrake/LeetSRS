import { STORAGE_KEYS } from './storage-keys';

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
  const slugToCardIdResult = await browser.storage.local.get(STORAGE_KEYS.slugToCardId);
  const slugToCardId: Record<string, string> = slugToCardIdResult[STORAGE_KEYS.slugToCardId] || {};
  if (slugToCardId[slug]) {
    const cardsResult = await browser.storage.local.get(STORAGE_KEYS.cards);
    const cards: Record<string, StoredCard> = cardsResult[STORAGE_KEYS.cards] || {};
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
  const cardsResult = await browser.storage.local.get(STORAGE_KEYS.cards);
  const cards: Record<string, StoredCard> = cardsResult[STORAGE_KEYS.cards] || {};
  cards[card.id] = serializeCard(card);
  slugToCardId[slug] = card.id;

  await browser.storage.local.set({
    [STORAGE_KEYS.cards]: cards,
    [STORAGE_KEYS.slugToCardId]: slugToCardId,
  });

  return card;
}

// export async function getCard(slug: string): Promise<Card | null> {
//   const result = await browser.storage.local.get([STORAGE_KEYS.cardIndex, STORAGE_KEYS.cards]);
//   const slugToCardId: Record<string, string> = result[STORAGE_KEYS.cardIndex] || {};
//   const cards: Record<string, StoredCard> = result[STORAGE_KEYS.cards] || {};

//   const cardId = slugToCardId[slug];
//   if (!cardId) return null;

//   const storedCard = cards[cardId];
//   if (!storedCard) return null;

//   return deserializeCard(storedCard);
// }

// export async function getAllCards(): Promise<Card[]> {
//   const result = await browser.storage.local.get(STORAGE_KEYS.cards);
//   const cards: Record<string, StoredCard> = result[STORAGE_KEYS.cards] || {};
//   return Object.values(cards).map(deserializeCard);
// }

// export async function removeCard(slug: string): Promise<void> {
//   const result = await browser.storage.local.get([STORAGE_KEYS.cardIndex, STORAGE_KEYS.cards]);
//   const slugToCardId: Record<string, string> = result[STORAGE_KEYS.cardIndex] || {};
//   const cards: Record<string, StoredCard> = result[STORAGE_KEYS.cards] || {};

//   const cardId = slugToCardId[slug];
//   if (!cardId) return;

//   delete cards[cardId];
//   delete slugToCardId[slug];

//   await browser.storage.local.set({
//     [STORAGE_KEYS.cards]: cards,
//     [STORAGE_KEYS.cardIndex]: slugToCardId,
//   });
// }

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
