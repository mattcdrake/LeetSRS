import { createEmptyCard, FSRS, State as FsrsState, generatorParameters } from 'ts-fsrs';
import { readLearningDocument, replaceLearningDocument } from '@/data/learning-document';
import type { Card, ProblemDescriptor, RateCardInput } from '@/domain/cards';
import { findCard, type LearningDocument } from '@/domain/learning-document';
import { calculateDelayedDueDate, isDue } from '@/domain/review';
import type { SettingsUpdate } from '@/domain/settings';
import { recordReview } from '@/domain/statistics';

import { triggerGistSync } from './gist-sync';

const fsrs = new FSRS(generatorParameters({ maximum_interval: 1000, enable_short_term: false }));

async function saveLocalLearningDocument(document: LearningDocument, now: Date): Promise<LearningDocument> {
  const saved = await replaceLearningDocument({ ...document, dataUpdatedAt: now.toISOString() });
  void triggerGistSync('save');
  return saved;
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

export async function addCard(problem: ProblemDescriptor): Promise<Card> {
  const now = new Date();
  const document = await readLearningDocument();
  const existing = findCard(document, problem.slug);
  if (existing) {
    return existing;
  }

  document.cards[problem.slug] = createCard(problem, now);
  requireCard(document, problem.slug);
  const saved = await saveLocalLearningDocument(document, now);
  return saved.cards[problem.slug];
}

export async function removeCard(slug: string): Promise<void> {
  const now = new Date();
  const document = await readLearningDocument();
  if (!findCard(document, slug)) return;
  delete document.cards[slug];
  await saveLocalLearningDocument(document, now);
}

export async function delayCard(slug: string, days: number): Promise<Card> {
  const now = new Date();
  const document = await readLearningDocument();
  const card = requireCard(document, slug);
  if (days === 0) return card;
  card.fsrs.due = calculateDelayedDueDate(card.fsrs.due, days);
  const saved = await saveLocalLearningDocument(document, now);
  return saved.cards[slug];
}

export async function setPauseStatus(slug: string, paused: boolean): Promise<Card> {
  const now = new Date();
  const document = await readLearningDocument();
  const card = requireCard(document, slug);
  if (card.paused === paused) return card;
  card.paused = paused;
  const saved = await saveLocalLearningDocument(document, now);
  return saved.cards[slug];
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

  document.stats = recordReview(document.stats, now, rating, isNewCard);

  requireCard(document, card.slug);
  const saved = await saveLocalLearningDocument(document, now);
  const savedCard = saved.cards[card.slug];
  return { card: savedCard, shouldRequeue: isDue(savedCard, now) };
}

export async function saveNote(slug: string, text: string): Promise<void> {
  const now = new Date();
  const document = await readLearningDocument();
  const card = requireCard(document, slug);
  if ((card.note ?? '') === text) return;
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

export async function updateSettings(changes: SettingsUpdate): Promise<void> {
  if (Object.keys(changes).length === 0) {
    return;
  }

  const now = new Date();
  const document = await readLearningDocument();
  if (Object.entries(changes).every(([key, value]) => document.settings[key as keyof SettingsUpdate] === value)) return;
  await saveLocalLearningDocument({ ...document, settings: { ...document.settings, ...changes } }, now);
}
