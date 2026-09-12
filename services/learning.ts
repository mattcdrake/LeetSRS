import { createEmptyCard, FSRS, State as FsrsState, generatorParameters } from 'ts-fsrs';
import { addLocalDays, formatLocalDate } from '@/domain/calendar';
import type { Card, ProblemDescriptor, RateCardInput } from '@/domain/cards';
import { findCard, type LearningDocument } from '@/domain/learning-document';
import { calculateDelayedDueDate, isDue } from '@/domain/review';
import { createDailyStats, recordReview } from '@/domain/statistics';
import { readLearningDocument } from '@/infrastructure/storage/learning-document';
import { saveLocalLearningDocument } from './save-local-learning-document';

const fsrs = new FSRS(generatorParameters({ maximum_interval: 1000 }));

function requireCard(document: LearningDocument, slug: string): Card {
  const card = findCard(document, slug);
  if (!card) {
    throw new Error(`Card with slug "${slug}" not found`);
  }
  return card;
}

function createCard(problem: ProblemDescriptor, now: Date): Card {
  const initialFsrs = createEmptyCard(now);
  return {
    id: crypto.randomUUID(),
    ...problem,
    createdAt: now.getTime(),
    fsrs: { ...initialFsrs, due: initialFsrs.due.getTime(), last_review: initialFsrs.last_review?.getTime() },
    paused: false,
  };
}

export async function addCard(problem: ProblemDescriptor): Promise<Card> {
  const now = new Date();
  const document = await readLearningDocument();
  const existing = findCard(document, problem.slug);
  if (existing) {
    return existing;
  }

  document.cards[problem.slug] = createCard(problem, now);
  const result = requireCard(document, problem.slug);
  await saveLocalLearningDocument(document, now);
  return result;
}

export async function removeCard(slug: string): Promise<void> {
  const now = new Date();
  const document = await readLearningDocument();
  delete document.cards[slug];
  await saveLocalLearningDocument(document, now);
}

export async function delayCard(slug: string, days: number): Promise<Card> {
  const now = new Date();
  const document = await readLearningDocument();
  const card = requireCard(document, slug);
  card.fsrs.due = calculateDelayedDueDate(card.fsrs.due, days);
  await saveLocalLearningDocument(document, now);
  return card;
}

export async function setPauseStatus(slug: string, paused: boolean): Promise<Card> {
  const now = new Date();
  const document = await readLearningDocument();
  const card = requireCard(document, slug);
  card.paused = paused;
  await saveLocalLearningDocument(document, now);
  return card;
}

export async function rateCard(input: RateCardInput): Promise<{ card: Card; shouldRequeue: boolean }> {
  const now = new Date();
  const document = await readLearningDocument();
  const { rating, ...problem } = input;
  const card = findCard(document, problem.slug) ?? createCard(problem, now);
  const isNewCard = card.fsrs.state === FsrsState.New;
  const schedulingResult = fsrs.next(card.fsrs, now, rating);
  card.fsrs = {
    ...schedulingResult.card,
    due: schedulingResult.card.due.getTime(),
    last_review: schedulingResult.card.last_review?.getTime(),
  };
  document.cards[card.slug] = card;

  const today = formatLocalDate(now);
  const yesterday = formatLocalDate(addLocalDays(now, -1));
  const todayStats = document.stats[today] ?? createDailyStats(today, document.stats[yesterday]);
  recordReview(todayStats, rating, isNewCard);
  document.stats[today] = todayStats;

  const savedCard = requireCard(document, card.slug);
  const result = { card: savedCard, shouldRequeue: isDue(savedCard, now) };
  await saveLocalLearningDocument(document, now);
  return result;
}

export async function saveNote(slug: string, text: string): Promise<void> {
  const now = new Date();
  const document = await readLearningDocument();
  const card = requireCard(document, slug);
  if (text === '') {
    delete card.note;
  } else {
    card.note = text;
  }
  await saveLocalLearningDocument(document, now);
}

export async function deleteNote(slug: string): Promise<void> {
  const now = new Date();
  const document = await readLearningDocument();
  const card = findCard(document, slug);
  if (!card || card.note === undefined) {
    return;
  }

  delete card.note;
  await saveLocalLearningDocument(document, now);
}
