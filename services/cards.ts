import { STORAGE_KEYS } from './storage-keys';

export interface Card {
  id: string;
  slug: string;
  name: string;
  createdAt: Date;
}

interface StoredCard extends Omit<Card, 'createdAt'> {
  createdAt: number;
}

interface CardsStorage {
  cards: Record<string, StoredCard>;
  slugToCardId: Record<string, string>;
}

// Public API
export async function addCard(slug: string, name: string): Promise<Card> {
  const storage = await getCardsStorage();

  // Check if card already exists
  const existingId = storage.slugToCardId[slug];
  if (existingId && storage.cards[existingId]) {
    return deserializeCard(storage.cards[existingId]);
  }

  // Create new card
  const card = createCard(slug, name);
  const storedCard = serializeCard(card);

  // Update storage
  storage.cards[card.id] = storedCard;
  storage.slugToCardId[slug] = card.id;

  await setCardsStorage(storage);
  return card;
}

export async function getCard(slug: string): Promise<Card | null> {
  const storage = await getCardsStorage();
  const cardId = storage.slugToCardId[slug];

  if (!cardId || !storage.cards[cardId]) {
    return null;
  }

  return deserializeCard(storage.cards[cardId]);
}

export async function getAllCards(): Promise<Card[]> {
  const storage = await getCardsStorage();
  return Object.values(storage.cards).map(deserializeCard);
}

export async function removeCard(slug: string): Promise<void> {
  const storage = await getCardsStorage();
  const cardId = storage.slugToCardId[slug];

  if (!cardId || !storage.cards[cardId]) {
    return;
  }

  delete storage.cards[cardId];
  delete storage.slugToCardId[slug];

  await setCardsStorage(storage);
}

// Pure functions for business logic
export function createCard(slug: string, name: string): Card {
  return {
    id: crypto.randomUUID(),
    slug,
    name,
    createdAt: new Date(),
  };
}

// Private functions for storage management
async function getCardsStorage(): Promise<CardsStorage> {
  const result = await browser.storage.local.get(STORAGE_KEYS.cards);
  return result[STORAGE_KEYS.cards] || getDefaultStorage();
}

async function setCardsStorage(storage: CardsStorage): Promise<void> {
  await browser.storage.local.set({ [STORAGE_KEYS.cards]: storage });
}

function serializeCard(card: Card): StoredCard {
  return {
    ...card,
    createdAt: card.createdAt.getTime(),
  };
}

function deserializeCard(stored: StoredCard): Card {
  return {
    ...stored,
    createdAt: new Date(stored.createdAt),
  };
}

function getDefaultStorage(): CardsStorage {
  return {
    cards: {},
    slugToCardId: {},
  };
}
