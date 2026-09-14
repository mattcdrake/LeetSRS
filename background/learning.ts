import { createEmptyCard, FSRS, State as FsrsState, generatorParameters } from 'ts-fsrs';
import { recordReview } from '@/background/review-activity';
import type { Card, ProblemDescriptor, RateCardInput } from '@/shared/models';
import { findCard, type LearningDocument } from '@/shared/models';
import type { SettingsUpdate } from '@/shared/settings';
import { readLearningDocument } from '@/shared/storage';
import { saveEdit } from './persistence';

const fsrs = new FSRS(generatorParameters({ maximum_interval: 1000, enable_short_term: false }));

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

export async function addCard(problem: ProblemDescriptor): Promise<void> {
  const now = new Date();
  const document = await readLearningDocument();
  const existing = findCard(document, problem.slug);
  if (existing) {
    return;
  }

  document.cards[problem.slug] = createCard(problem, now);
  requireCard(document, problem.slug);
  await saveEdit(document, now);
}

export async function removeCard(slug: string): Promise<void> {
  const now = new Date();
  const document = await readLearningDocument();
  if (!findCard(document, slug)) return;
  delete document.cards[slug];
  await saveEdit(document, now);
}

export async function delayCard(slug: string, days: number): Promise<void> {
  const now = new Date();
  const document = await readLearningDocument();
  const card = requireCard(document, slug);
  if (days === 0) return;
  card.fsrs.due = calculateDelayedDueDate(card.fsrs.due, days);
  await saveEdit(document, now);
}

export async function setPauseStatus(slug: string, paused: boolean): Promise<void> {
  const now = new Date();
  const document = await readLearningDocument();
  const card = requireCard(document, slug);
  if (card.paused === paused) return;
  card.paused = paused;
  await saveEdit(document, now);
}

export async function rateCard(input: RateCardInput): Promise<void> {
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

  document.reviewActivity = recordReview(document.reviewActivity, now, isNewCard);

  requireCard(document, card.slug);
  await saveEdit(document, now);
}

export async function saveNote(slug: string, text: string): Promise<void> {
  const now = new Date();
  const document = await readLearningDocument();
  const card = text === '' ? findCard(document, slug) : requireCard(document, slug);
  if (!card) return;
  if ((card.note ?? '') === text) return;
  if (text === '') {
    delete card.note;
  } else {
    card.note = text;
  }
  await saveEdit(document, now);
}

export async function updateSettings(changes: SettingsUpdate): Promise<void> {
  if (Object.keys(changes).length === 0) {
    return;
  }

  const now = new Date();
  const document = await readLearningDocument();
  if (Object.entries(changes).every(([key, value]) => document.settings[key as keyof SettingsUpdate] === value)) return;
  await saveEdit({ ...document, settings: { ...document.settings, ...changes } }, now);
}

export function calculateDelayedDueDate(due: number, days: number): number {
  const newDueDate = new Date(due);
  newDueDate.setDate(newDueDate.getDate() + days);
  return newDueDate.getTime();
}
