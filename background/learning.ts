import { createEmptyCard, FSRS, State as FsrsState, generatorParameters } from 'ts-fsrs';
import { recordReview } from '@/background/review-activity';
import type { Card, ProblemReference, RateCardInput } from '@/shared/models';
import { findCard, type LearningDocument } from '@/shared/models';
import type { SettingsUpdate } from '@/shared/settings';
import { readLearningDocument } from '@/shared/storage';
import { saveEdit } from './persistence';

const fsrs = new FSRS(generatorParameters({ maximum_interval: 1000, enable_short_term: false }));

function requireCard(document: LearningDocument, frontendId: string): Card {
  const card = findCard(document, frontendId);
  if (!card) {
    throw new Error(`Card with frontendId "${frontendId}" not found`);
  }
  return card;
}

function createCard(problem: ProblemReference, now: Date): Card {
  const initialFsrs = createEmptyCard(now);
  return {
    frontendId: problem.frontendId,
    domain: problem.domain,
    createdAt: now.getTime(),
    fsrs: { ...initialFsrs, due: initialFsrs.due.getTime(), last_review: initialFsrs.last_review?.getTime() },
    paused: false,
  };
}

export async function addCard(problem: ProblemReference): Promise<void> {
  const now = new Date();
  const document = await readLearningDocument();
  const existing = findCard(document, problem.frontendId);
  if (existing) {
    return;
  }

  document.cards[problem.frontendId] = createCard(problem, now);
  await saveEdit(document, now);
}

export async function removeCard(frontendId: string): Promise<void> {
  const now = new Date();
  const document = await readLearningDocument();
  if (!findCard(document, frontendId)) return;
  delete document.cards[frontendId];
  await saveEdit(document, now);
}

export async function delayCard(frontendId: string, days: number): Promise<void> {
  const now = new Date();
  const document = await readLearningDocument();
  const card = requireCard(document, frontendId);
  if (days === 0) return;
  card.fsrs.due = calculateDelayedDueDate(card.fsrs.due, days);
  await saveEdit(document, now);
}

export async function setPauseStatus(frontendId: string, paused: boolean): Promise<void> {
  const now = new Date();
  const document = await readLearningDocument();
  const card = requireCard(document, frontendId);
  if (card.paused === paused) return;
  card.paused = paused;
  await saveEdit(document, now);
}

export async function rateCard(input: RateCardInput): Promise<void> {
  const now = new Date();
  const document = await readLearningDocument();
  const { rating, ...problem } = input;
  const card = findCard(document, problem.frontendId) ?? createCard(problem, now);
  const isNewCard = card.fsrs.state === FsrsState.New;
  const schedulingResult = fsrs.next(card.fsrs, now, rating);
  card.fsrs = {
    ...schedulingResult.card,
    due: schedulingResult.card.due.getTime(),
    last_review: schedulingResult.card.last_review?.getTime(),
  };
  document.cards[card.frontendId] = card;

  document.reviewActivity = recordReview(document.reviewActivity, now, isNewCard);

  await saveEdit(document, now);
}

export async function saveNote(frontendId: string, text: string): Promise<void> {
  const now = new Date();
  const document = await readLearningDocument();
  const card = text === '' ? findCard(document, frontendId) : requireCard(document, frontendId);
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
