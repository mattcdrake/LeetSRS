import { readLearningDocument, replaceLearningDocument } from '@/data/learning-document';
import type { Card, ProblemDescriptor, RateCardInput } from '@/domain/cards';
import { createFsrsScheduler } from '@/domain/fsrs-scheduler';
import { findCard, type LearningDocument } from '@/domain/learning-document';
import { calculateDelayedDueDate } from '@/domain/review';
import { LearningState } from '@/domain/scheduling';
import type { SettingsUpdate } from '@/domain/settings';
import { recordReview } from '@/domain/statistics';

import { triggerGistSync } from './gist-sync';

const scheduler = createFsrsScheduler();

async function saveLocalLearningDocument(document: LearningDocument, now: Date): Promise<void> {
  await replaceLearningDocument({ ...document, dataUpdatedAt: now.toISOString() });
  void triggerGistSync();
}

function requireCard(document: LearningDocument, slug: string): Card {
  const card = findCard(document, slug);
  if (!card) {
    throw new Error(`Card with slug "${slug}" not found`);
  }
  return card;
}

function createCard(problem: ProblemDescriptor, now: Date): Card {
  return {
    id: crypto.randomUUID(),
    ...problem,
    createdAt: now.getTime(),
    fsrs: scheduler.createSchedule(now),
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
  await saveLocalLearningDocument(document, now);
}

export async function removeCard(slug: string): Promise<void> {
  const now = new Date();
  const document = await readLearningDocument();
  if (!findCard(document, slug)) return;
  delete document.cards[slug];
  await saveLocalLearningDocument(document, now);
}

export async function delayCard(slug: string, days: number): Promise<void> {
  const now = new Date();
  const document = await readLearningDocument();
  const card = requireCard(document, slug);
  if (days === 0) return;
  card.fsrs.due = calculateDelayedDueDate(card.fsrs.due, days);
  await saveLocalLearningDocument(document, now);
}

export async function setPauseStatus(slug: string, paused: boolean): Promise<void> {
  const now = new Date();
  const document = await readLearningDocument();
  const card = requireCard(document, slug);
  if (card.paused === paused) return;
  card.paused = paused;
  await saveLocalLearningDocument(document, now);
}

export async function rateCard(input: RateCardInput): Promise<void> {
  const now = new Date();
  const document = await readLearningDocument();
  const { rating, ...problem } = input;
  const card = findCard(document, problem.slug) ?? createCard(problem, now);
  const isNewCard = card.fsrs.state === LearningState.New;
  card.fsrs = scheduler.review(card.fsrs, rating, now);
  document.cards[card.slug] = card;

  document.stats = recordReview(document.stats, now, rating, isNewCard);

  requireCard(document, card.slug);
  await saveLocalLearningDocument(document, now);
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
  await saveLocalLearningDocument(document, now);
}

export async function updateSettings(changes: SettingsUpdate): Promise<void> {
  if (Object.keys(changes).length === 0) {
    return;
  }

  const now = new Date();
  const document = await readLearningDocument();
  if (Object.entries(changes).every(([key, value]) => document.settings[key as keyof SettingsUpdate] === value)) return;
  await saveLocalLearningDocument({ ...document, settings: { ...document.settings, ...changes } }, now);
}
