import { createEmptyCard, FSRS, type Card as FsrsCard, State as FsrsState, generatorParameters } from 'ts-fsrs';
import { storage } from '#imports';
import type { Card, ProblemDescriptor, RateCardInput } from '@/domain/cards';
import { isDueByDate as calculateIsDueByDate } from '@/domain/review-day';
import { buildReviewQueue, partitionDueCards } from '@/domain/review-queue';
import { calculateDelayedDueDate, scheduleReview } from '@/domain/scheduling';
import { STORAGE_KEYS } from '@/infrastructure/storage/storage-keys';
import { deleteNote } from './notes';
import { getSettings } from './settings';
import { getTodayStats, updateStats } from './stats';

const params = generatorParameters({ maximum_interval: 1000 });
const fsrs = new FSRS(params);

export interface StoredCard extends Omit<Card, 'createdAt' | 'fsrs' | 'domain'> {
  domain?: Card['domain'];
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
    domain: stored.domain ?? 'leetcode.com',
    createdAt: new Date(stored.createdAt),
    fsrs: {
      ...rest,
      due: new Date(due),
      last_review: last_review ? new Date(last_review) : undefined,
    },
  };
}

function createCard(problem: ProblemDescriptor): Card {
  return {
    id: crypto.randomUUID(),
    ...problem,
    createdAt: new Date(),
    fsrs: createEmptyCard(),
    paused: false,
  };
}

export async function addCard(problem: ProblemDescriptor): Promise<Card> {
  const cards = await getCards();
  const { slug } = problem;
  if (slug in cards) {
    return deserializeCard(cards[slug]);
  }

  const card = createCard(problem);
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

  const newDueDate = calculateDelayedDueDate(card.fsrs.due, days);

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

export async function rateCard(input: RateCardInput): Promise<{ card: Card; shouldRequeue: boolean }> {
  const cards = await getCards();
  const { rating, ...problem } = input;
  const { slug } = problem;

  let card: Card;
  let isNewCard = true;
  if (slug in cards) {
    card = deserializeCard(cards[slug]);
    isNewCard = card.fsrs.state === FsrsState.New;
  } else {
    card = createCard(problem);
  }

  const now = new Date();
  const schedulingResult = scheduleReview(fsrs, card.fsrs, now, rating);
  card.fsrs = schedulingResult.card;
  cards[slug] = serializeCard(card);
  await storage.setItem(STORAGE_KEYS.cards, cards);

  await updateStats(rating, isNewCard);

  const settings = await getSettings();
  const shouldRequeue = isDueByDate(card, now, settings.dayStartHour);

  return { card, shouldRequeue };
}

export function isDueByDate(card: Card, referenceDate: Date = new Date(), dayStartHour: number = 0): boolean {
  return calculateIsDueByDate(card, referenceDate, dayStartHour);
}

export async function getReviewQueue(): Promise<Card[]> {
  const allCards = await getAllCards();
  const settings = await getSettings();
  const dueCards = allCards.filter((card) => !card.paused && isDueByDate(card, new Date(), settings.dayStartHour));

  const { reviewCards, newCards } = partitionDueCards(dueCards);

  const todayStats = await getTodayStats();
  const newCardsCompletedToday = todayStats?.newCards ?? 0;
  return buildReviewQueue(reviewCards, newCards, settings.maxNewCardsPerDay, newCardsCompletedToday);
}
