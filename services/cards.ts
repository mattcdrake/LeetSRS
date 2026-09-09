import { createEmptyCard, FSRS, State as FsrsState, generatorParameters } from 'ts-fsrs';
import type { Card, ProblemDescriptor, RateCardInput } from '@/domain/cards';
import { buildReviewQueue, calculateDelayedDueDate, isDueByDate as calculateIsDueByDate } from '@/domain/review';
import { getAllCards, saveCards } from '@/infrastructure/storage/cards';

import { deleteNote } from '@/infrastructure/storage/notes';
import { getSettings } from './settings';
import { getTodayStats, updateStats } from './stats';

export { getAllCards } from '@/infrastructure/storage/cards';

const params = generatorParameters({ maximum_interval: 1000 });
const fsrs = new FSRS(params);

function createCard(problem: ProblemDescriptor): Card {
  const initialFsrs = createEmptyCard();
  return {
    id: crypto.randomUUID(),
    ...problem,
    createdAt: Date.now(),
    fsrs: { ...initialFsrs, due: initialFsrs.due.getTime(), last_review: initialFsrs.last_review?.getTime() },
    paused: false,
  };
}

export async function addCard(problem: ProblemDescriptor): Promise<Card> {
  const cards = await getAllCards();
  const { slug } = problem;
  const existing = cards.find((card) => card.slug === slug);
  if (existing) {
    return existing;
  }

  const card = createCard(problem);
  await saveCards([...cards, card]);
  return card;
}

export async function removeCard(slug: string): Promise<void> {
  const cards = await getAllCards();

  const card = cards.find((card) => card.slug === slug);
  if (card) {
    await deleteNote(card.id);
  }

  await saveCards(cards.filter((card) => card.slug !== slug));
}

export async function delayCard(slug: string, days: number): Promise<Card> {
  const cards = await getAllCards();

  const card = cards.find((card) => card.slug === slug);
  if (!card) {
    throw new Error(`Card with slug "${slug}" not found`);
  }

  const newDueDate = calculateDelayedDueDate(card.fsrs.due, days);

  card.fsrs.due = newDueDate;
  await saveCards(cards);

  return card;
}

export async function setPauseStatus(slug: string, paused: boolean): Promise<Card> {
  const cards = await getAllCards();

  const card = cards.find((card) => card.slug === slug);
  if (!card) {
    throw new Error(`Card with slug "${slug}" not found`);
  }

  card.paused = paused;
  await saveCards(cards);

  return card;
}

export async function rateCard(input: RateCardInput): Promise<{ card: Card; shouldRequeue: boolean }> {
  const cards = await getAllCards();
  const { rating, ...problem } = input;
  const { slug } = problem;

  let card = cards.find((card) => card.slug === slug);
  if (!card) {
    card = createCard(problem);
    cards.push(card);
  }
  const isNewCard = card.fsrs.state === FsrsState.New;

  const now = new Date();
  const schedulingResult = fsrs.next(card.fsrs, now, rating);
  card.fsrs = {
    ...schedulingResult.card,
    due: schedulingResult.card.due.getTime(),
    last_review: schedulingResult.card.last_review?.getTime(),
  };
  await saveCards(cards);
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
  const todayStats = await getTodayStats();
  const newCardsCompletedToday = todayStats?.newCards ?? 0;
  return buildReviewQueue(dueCards, settings.maxNewCardsPerDay, newCardsCompletedToday);
}
