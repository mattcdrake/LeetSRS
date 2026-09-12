import { createEmptyCard, FSRS, State as FsrsState, generatorParameters } from 'ts-fsrs';
import { addLocalDays, formatLocalDate } from '@/domain/calendar';
import {
  type Card,
  type LeetcodeDomain,
  noteTextSchema,
  type ProblemDescriptor,
  type RateCardInput,
} from '@/domain/cards';
import { type LearningDocument, learningDocumentSchema } from '@/domain/learning-document';
import { buildReviewQueue, calculateDelayedDueDate, isDue } from '@/domain/review';
import { resolveSettings } from '@/domain/settings';
import {
  calculateHistoryStats,
  calculateUpcomingStats,
  countCardStates,
  createDailyStats,
  type DailyStats,
  recordReview,
  type UpcomingReviewStats,
} from '@/domain/statistics';
import { detectBrowserLanguage } from '@/infrastructure/browser/language';
import { readLearningDocument, replaceLearningDocument } from '@/infrastructure/storage/learning-document';

const fsrs = new FSRS(generatorParameters({ maximum_interval: 1000 }));

async function getDocument(): Promise<LearningDocument> {
  const document = await readLearningDocument();
  if (!document) {
    throw new Error('Learning document is not initialized');
  }
  return document;
}

function prepareLocalEdit(document: LearningDocument, now: Date): LearningDocument {
  return learningDocumentSchema.parse({ ...document, dataUpdatedAt: now.toISOString() });
}

function findCard(document: LearningDocument, slug: string): Card | undefined {
  if (Object.hasOwn(document.cards, slug)) {
    return document.cards[slug];
  }
  return undefined;
}

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

export async function getAllCards(): Promise<Card[]> {
  return Object.values((await getDocument()).cards);
}

export async function addCard(problem: ProblemDescriptor): Promise<Card> {
  const now = new Date();
  const document = await getDocument();
  const existing = findCard(document, problem.slug);
  if (existing) {
    return existing;
  }

  document.cards[problem.slug] = createCard(problem, now);
  const next = prepareLocalEdit(document, now);
  const result = requireCard(next, problem.slug);
  await replaceLearningDocument(next);
  return result;
}

export async function removeCard(slug: string): Promise<void> {
  const now = new Date();
  const document = await getDocument();
  delete document.cards[slug];
  const next = prepareLocalEdit(document, now);
  await replaceLearningDocument(next);
}

export async function delayCard(slug: string, days: number): Promise<Card> {
  const now = new Date();
  const document = await getDocument();
  const card = requireCard(document, slug);
  card.fsrs.due = calculateDelayedDueDate(card.fsrs.due, days);
  const next = prepareLocalEdit(document, now);
  const result = requireCard(next, slug);
  await replaceLearningDocument(next);
  return result;
}

export async function setPauseStatus(slug: string, paused: boolean): Promise<Card> {
  const now = new Date();
  const document = await getDocument();
  const card = requireCard(document, slug);
  card.paused = paused;
  const next = prepareLocalEdit(document, now);
  const result = requireCard(next, slug);
  await replaceLearningDocument(next);
  return result;
}

export async function rateCard(input: RateCardInput): Promise<{ card: Card; shouldRequeue: boolean }> {
  const now = new Date();
  const document = await getDocument();
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

  const next = prepareLocalEdit(document, now);
  const savedCard = requireCard(next, card.slug);
  const result = { card: savedCard, shouldRequeue: isDue(savedCard, now) };
  await replaceLearningDocument(next);
  return result;
}

export async function getTodayStats(): Promise<DailyStats | null> {
  const now = new Date();
  const document = await getDocument();
  return document.stats[formatLocalDate(now)] ?? null;
}

export async function getCardStateStats(): Promise<Record<FsrsState, number>> {
  const document = await getDocument();
  return countCardStates(Object.values(document.cards));
}

export async function getLastNDaysStats(days: number): Promise<DailyStats[]> {
  const now = new Date();
  const document = await getDocument();
  return calculateHistoryStats(document.stats, days, now);
}

export async function getNextNDaysStats(days: number): Promise<UpcomingReviewStats[]> {
  const now = new Date();
  const document = await getDocument();
  return calculateUpcomingStats(Object.values(document.cards), days, now);
}

export async function getReviewQueue(): Promise<Card[]> {
  const now = new Date();
  const document = await getDocument();
  const settings = resolveSettings(document.settings, document.settings.language ?? detectBrowserLanguage());
  const dueCards = Object.values(document.cards).filter((card) => !card.paused && isDue(card, now));
  const newCardsCompletedToday = document.stats[formatLocalDate(now)]?.newCards ?? 0;
  return buildReviewQueue(dueCards, settings.maxNewCardsPerDay, newCardsCompletedToday);
}

export async function shouldResetEditor(slug: string, domain: LeetcodeDomain): Promise<boolean> {
  const now = new Date();
  const document = await getDocument();
  const settings = resolveSettings(document.settings, document.settings.language ?? detectBrowserLanguage());
  if (settings.resetEditorOnEveryProblem) {
    return true;
  }
  if (!settings.resetEditorOnDueReview) {
    return false;
  }

  const card = findCard(document, slug);
  return !!card && card.domain === domain && !card.paused && isDue(card, now);
}

export async function getNote(slug: string): Promise<string | null> {
  const document = await getDocument();
  return findCard(document, slug)?.note ?? null;
}

export async function saveNote(slug: string, text: string): Promise<void> {
  const note = noteTextSchema.parse(text);
  const now = new Date();
  const document = await getDocument();
  const card = requireCard(document, slug);
  if (note === '') {
    delete card.note;
  } else {
    card.note = note;
  }
  const next = prepareLocalEdit(document, now);
  await replaceLearningDocument(next);
}

export async function deleteNote(slug: string): Promise<void> {
  const now = new Date();
  const document = await getDocument();
  const card = findCard(document, slug);
  if (!card || card.note === undefined) {
    return;
  }

  delete card.note;
  const next = prepareLocalEdit(document, now);
  await replaceLearningDocument(next);
}
