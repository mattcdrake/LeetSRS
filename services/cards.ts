import {
  FSRS,
  State as FsrsState,
  createEmptyCard,
  generatorParameters,
  type Card as FsrsCard,
  type Grade,
} from 'ts-fsrs';
import { STORAGE_KEYS } from './storage-keys';
import { storage } from '#imports';
import { interleaveArrays } from './utils';
import { updateStats, getTodayStats } from './stats';
import { deleteNote } from './notes';
import { type Card, type Difficulty } from '@/shared/cards';

export const MAX_NEW_CARDS_PER_DAY = 3;
const params = generatorParameters({ maximum_interval: 1000 });
const fsrs = new FSRS(params);

// Format date as YYYY-MM-DD in local timezone for comparison
function formatLocalDate(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
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

function createCard(slug: string, name: string, leetcodeId: string, difficulty: Difficulty): Card {
  return {
    id: crypto.randomUUID(),
    slug,
    name,
    leetcodeId,
    difficulty,
    createdAt: new Date(),
    fsrs: createEmptyCard(),
    paused: false,
  };
}

export async function addCard(slug: string, name: string, leetcodeId: string, difficulty: Difficulty): Promise<Card> {
  const cards = await getCards();
  if (slug in cards) {
    return deserializeCard(cards[slug]);
  }

  const card = createCard(slug, name, leetcodeId, difficulty);
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

  // Delete the associated note if the card exists
  const card = cards[slug];
  if (card) {
    await deleteNote(card.id);
  }

  delete cards[slug];
  await storage.setItem(STORAGE_KEYS.cards, cards);
}

export async function delayCard(slug: string, days: number): Promise<Card> {
  const cards = await getCards();

  if (!(slug in cards)) {
    throw new Error(`Card with slug "${slug}" not found`);
  }

  const card = deserializeCard(cards[slug]);

  // Add the specified number of days to the current due date
  const currentDueDate = new Date(card.fsrs.due);
  const newDueDate = new Date(currentDueDate);
  newDueDate.setDate(newDueDate.getDate() + days);

  // Update and save
  card.fsrs.due = newDueDate;
  cards[slug] = serializeCard(card);
  await storage.setItem(STORAGE_KEYS.cards, cards);

  return card;
}

export async function setPauseStatus(slug: string, paused: boolean): Promise<Card> {
  const cards = await getCards();

  if (!(slug in cards)) {
    throw new Error(`Card with slug "${slug}" not found`);
  }

  const card = deserializeCard(cards[slug]);
  card.paused = paused;
  cards[slug] = serializeCard(card);
  await storage.setItem(STORAGE_KEYS.cards, cards);

  return card;
}

export async function rateCard(
  slug: string,
  name: string,
  rating: Grade,
  leetcodeId: string,
  difficulty: Difficulty
): Promise<{ card: Card; shouldRequeue: boolean }> {
  const cards = await getCards();

  let card: Card;
  let isNewCard = true;
  if (slug in cards) {
    card = deserializeCard(cards[slug]);
    isNewCard = card.fsrs.state === FsrsState.New;
  } else {
    card = createCard(slug, name, leetcodeId, difficulty);
  }

  const now = new Date();
  const schedulingResult = fsrs.next(card.fsrs, now, rating);
  card.fsrs = schedulingResult.card;
  cards[slug] = serializeCard(card);
  await storage.setItem(STORAGE_KEYS.cards, cards);

  // Update stats tracking
  await updateStats(rating, isNewCard);

  const shouldRequeue = isDueToday(card);

  return { card, shouldRequeue };
}

export function isDueToday(card: Card): boolean {
  const now = new Date();
  const dueDate = new Date(card.fsrs.due);

  // Compare dates in user's local timezone
  const todayStr = formatLocalDate(now);
  const dueStr = formatLocalDate(dueDate);
  return dueStr <= todayStr;
}

export async function getReviewQueue(): Promise<Card[]> {
  const allCards = await getAllCards();
  // Filter out paused cards and cards not due yet
  const dueCards = allCards.filter((card) => !card.paused && isDueToday(card));

  // Separate into review cards and new cards
  const reviewCards = dueCards.filter((card) => card.fsrs.state !== FsrsState.New);
  const newCards = dueCards.filter((card) => card.fsrs.state === FsrsState.New);

  // Get today's stats to determine how many new cards have already been done
  const todayStats = await getTodayStats();
  const newCardsCompletedToday = todayStats?.newCards ?? 0;
  const remainingNewCards = Math.max(0, MAX_NEW_CARDS_PER_DAY - newCardsCompletedToday);

  // Limit new cards to the remaining daily allowance
  const limitedNewCards = newCards.slice(0, remainingNewCards);

  return interleaveArrays(reviewCards, limitedNewCards);
}
