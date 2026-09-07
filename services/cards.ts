import { createEmptyCard, FSRS, State as FsrsState, generatorParameters } from 'ts-fsrs';
import type { Card, ProblemDescriptor, RateCardInput } from '@/domain/cards';
import {
  buildReviewQueue,
  calculateDelayedDueDate,
  isDueByDate as calculateIsDueByDate,
  partitionDueCards,
} from '@/domain/review';
import { scheduleReview } from '@/domain/scheduling';
import { getAllCards, loadCardStore } from '@/infrastructure/storage/cards/store';

import { deleteNote } from './notes';
import { getSettings } from './settings';
import { getTodayStats, updateStats } from './stats';

export { getAllCards } from '@/infrastructure/storage/cards/store';

const params = generatorParameters({ maximum_interval: 1000 });
const fsrs = new FSRS(params);

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
  const cards = await loadCardStore();
  const { slug } = problem;
  if (cards.has(slug)) {
    return cards.get(slug);
  }

  const card = createCard(problem);
  await cards.save(slug, card);
  return card;
}

export async function removeCard(slug: string): Promise<void> {
  const cards = await loadCardStore();

  const card = cards.getReference(slug);
  if (card) {
    await deleteNote(card.id);
  }

  await cards.remove(slug);
}

export async function delayCard(slug: string, days: number): Promise<Card> {
  const cards = await loadCardStore();

  if (!cards.has(slug)) {
    throw new Error(`Card with slug "${slug}" not found`);
  }

  const card = cards.get(slug);

  const newDueDate = calculateDelayedDueDate(card.fsrs.due, days);

  card.fsrs.due = newDueDate;
  await cards.save(slug, card);

  return card;
}

export async function setPauseStatus(slug: string, paused: boolean): Promise<Card> {
  const cards = await loadCardStore();

  if (!cards.has(slug)) {
    throw new Error(`Card with slug "${slug}" not found`);
  }

  const card = cards.get(slug);
  card.paused = paused;
  await cards.save(slug, card);

  return card;
}

export async function rateCard(input: RateCardInput): Promise<{ card: Card; shouldRequeue: boolean }> {
  const cards = await loadCardStore();
  const { rating, ...problem } = input;
  const { slug } = problem;

  let card: Card;
  let isNewCard = true;
  if (cards.has(slug)) {
    card = cards.get(slug);
    isNewCard = card.fsrs.state === FsrsState.New;
  } else {
    card = createCard(problem);
  }

  const now = new Date();
  const schedulingResult = scheduleReview(fsrs, card.fsrs, now, rating);
  card.fsrs = schedulingResult.card;
  await cards.save(slug, card);

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
