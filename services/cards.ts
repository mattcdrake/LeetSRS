import { type Card as FsrsCard, createEmptyCard, FSRS, type Grade, generatorParameters } from 'ts-fsrs';
import { STORAGE_KEYS } from './storage-keys';
import { storage } from '#imports';

const params = generatorParameters({ maximum_interval: 1000 });
const fsrs = new FSRS(params);

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

function createCard(slug: string, name: string): Card {
  return {
    slug,
    name,
    createdAt: new Date(),
    fsrs: createEmptyCard(),
  };
}

export async function addCard(slug: string, name: string): Promise<Card> {
  const cards = await getCards();
  if (slug in cards) {
    return deserializeCard(cards[slug]);
  }

  const card = createCard(slug, name);
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

export async function rateCard(slug: string, rating: Grade): Promise<Card> {
  const cards = await getCards();

  let card: Card;
  if (slug in cards) {
    card = deserializeCard(cards[slug]);
  } else {
    card = createCard(slug, slug);
  }

  const now = new Date();
  const schedulingResult = fsrs.next(card.fsrs, now, rating);
  card.fsrs = schedulingResult.card;
  cards[slug] = serializeCard(card);
  await storage.setItem(STORAGE_KEYS.cards, cards);
  return card;
}
