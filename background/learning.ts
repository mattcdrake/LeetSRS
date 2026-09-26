import { createEmptyCard, FSRS, State as FsrsState, generatorParameters } from 'ts-fsrs';
import { z } from 'zod';
import { storage } from '#imports';
import { parseLearningDocumentBackup } from '@/background/legacy/learning-document-conversions';
import { removeLegacyLearningData } from '@/background/legacy/learning-document-startup';
import { recordReview } from '@/background/review-activity';
import { signOutGithub, sync } from '@/background/sync';
import {
  type Card,
  cardSchema,
  findCard,
  LEARNING_DOCUMENT_VERSION,
  type LearningDocument,
  type ProblemReference,
  type RateCardInput,
  type RatingPreview,
  readLearningDocument,
  replaceLearningDocument,
  reviewActivitySchema,
  type SaveProblemInput,
} from '@/shared/learning-document';
import type { RoadmapId } from '@/shared/roadmap';
import type { SettingsUpdate } from '@/shared/settings';

const fsrs = new FSRS(generatorParameters({ maximum_interval: 1000, enable_short_term: false }));

const UNCHANGED = Symbol('unchanged');

// Applies one change to the stored document. Returning UNCHANGED skips the save.
async function edit<T>(change: (document: LearningDocument, now: Date) => T): Promise<T> {
  const now = new Date();
  const document = await readLearningDocument();
  const result = change(document, now);
  if (result !== UNCHANGED) {
    await replaceLearningDocument({ ...document, dataUpdatedAt: now.toISOString() });
    void sync();
  }
  return result;
}

export async function importData(json: string): Promise<void> {
  const document = parseLearningDocumentBackup(json);
  await replaceLearningDocument(document);
}

export async function resetAllData(): Promise<void> {
  await replaceLearningDocument({
    schemaVersion: LEARNING_DOCUMENT_VERSION,
    cards: {},
    reviewActivity: null,
    settings: {},
    activeRoadmapId: null,
    roadmapSkips: {},
  });
  await signOutGithub();
  await removeLegacyLearningData();
}

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
  await edit((document, now) => {
    if (findCard(document, problem.frontendId)) return UNCHANGED;
    document.cards[problem.frontendId] = createCard(problem, now);
  });
}

export async function removeCard(frontendId: string): Promise<void> {
  await edit((document) => {
    if (!findCard(document, frontendId)) return UNCHANGED;
    delete document.cards[frontendId];
  });
}

export async function delayCard(frontendId: string, days: number): Promise<void> {
  await edit((document) => {
    const card = requireCard(document, frontendId);
    if (days === 0) return UNCHANGED;
    card.fsrs.due = calculateDelayedDueDate(card.fsrs.due, days);
  });
}

export async function setPauseStatus(frontendId: string, paused: boolean): Promise<void> {
  await edit((document) => {
    const card = requireCard(document, frontendId);
    if (card.paused === paused) return UNCHANGED;
    card.paused = paused;
  });
}

export function rateCard(input: RateCardInput): Promise<Card> {
  return edit((document, now) => applyRating(document, input, now));
}

function applyRating(document: LearningDocument, input: RateCardInput, now: Date): Card {
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
  return card;
}

// Session storage keeps the latest save undoable across service worker restarts.
const undoSnapshotSchema = z.object({
  token: z.string(),
  frontendId: z.string(),
  previousCard: cardSchema.nullable(),
  previousActivity: reviewActivitySchema.nullable(),
  savedCard: cardSchema,
});
type UndoSnapshot = z.infer<typeof undoSnapshotSchema>;
const undoSnapshotItem = storage.defineItem<UndoSnapshot>('session:leetsrs:undoSnapshot');

// Rates or adds a problem from the rating panel and records how to undo it.
export async function saveProblem({
  rating,
  ...problem
}: SaveProblemInput): Promise<{ card: Card; undoToken: string }> {
  let snapshot: UndoSnapshot | undefined;
  await edit((document, now) => {
    const previousCard = findCard(document, problem.frontendId);
    const previous = {
      token: crypto.randomUUID(),
      frontendId: problem.frontendId,
      previousCard: previousCard ? structuredClone(previousCard) : null,
      previousActivity: document.reviewActivity,
    };
    if (rating !== undefined) {
      snapshot = { ...previous, savedCard: structuredClone(applyRating(document, { ...problem, rating }, now)) };
      return;
    }
    if (previousCard) {
      snapshot = { ...previous, savedCard: previousCard };
      return UNCHANGED;
    }
    const card = createCard(problem, now);
    document.cards[problem.frontendId] = card;
    snapshot = { ...previous, savedCard: structuredClone(card) };
  });
  const saved = undoSnapshotSchema.parse(snapshot);
  await undoSnapshotItem.setValue(saved);
  return { card: saved.savedCard, undoToken: saved.token };
}

// Restores the document from before a save, unless the card changed since.
export async function undoSave(token: string): Promise<void> {
  const snapshot = undoSnapshotSchema.safeParse(await undoSnapshotItem.getValue()).data;
  if (snapshot?.token !== token) throw new Error('This save can no longer be undone');
  await edit((document) => {
    const current = findCard(document, snapshot.frontendId);
    if (!current || JSON.stringify(cardSchema.parse(current)) !== JSON.stringify(snapshot.savedCard)) {
      throw new Error('The card changed after saving');
    }
    if (snapshot.previousCard) document.cards[snapshot.frontendId] = snapshot.previousCard;
    else delete document.cards[snapshot.frontendId];
    document.reviewActivity = snapshot.previousActivity;
  });
  await undoSnapshotItem.removeValue();
}

export type CardStatus = { due: number; paused: boolean; reps: number };

export async function getCardStatus(frontendId: string): Promise<CardStatus | null> {
  const card = findCard(await readLearningDocument(), frontendId);
  return card ? { due: card.fsrs.due, paused: card.paused, reps: card.fsrs.reps } : null;
}

export async function saveNote(frontendId: string, text: string): Promise<void> {
  await edit((document) => {
    const card = text === '' ? findCard(document, frontendId) : requireCard(document, frontendId);
    if (!card || (card.note ?? '') === text) return UNCHANGED;
    if (text === '') {
      delete card.note;
    } else {
      card.note = text;
    }
  });
}

export async function updateSettings(changes: SettingsUpdate): Promise<void> {
  await edit((document) => {
    if (Object.entries(changes).every(([key, value]) => document.settings[key as keyof SettingsUpdate] === value)) {
      return UNCHANGED;
    }
    document.settings = { ...document.settings, ...changes };
  });
}

export function calculateDelayedDueDate(due: number, days: number): number {
  const newDueDate = new Date(due);
  newDueDate.setDate(newDueDate.getDate() + days);
  return newDueDate.getTime();
}

export async function setActiveRoadmap(id: RoadmapId | null): Promise<void> {
  await edit((document) => {
    if (document.activeRoadmapId === id) return UNCHANGED;
    document.activeRoadmapId = id;
  });
}

export async function setRoadmapProblemSkipped(
  roadmapId: RoadmapId,
  frontendId: string,
  skipped: boolean
): Promise<void> {
  await edit((document) => {
    const ids = new Set(document.roadmapSkips[roadmapId]);
    if (ids.has(frontendId) === skipped) return UNCHANGED;
    if (skipped) {
      ids.add(frontendId);
    } else {
      ids.delete(frontendId);
    }
    document.roadmapSkips[roadmapId] = [...ids];
  });
}

export async function previewRatings(problem: ProblemReference): Promise<RatingPreview> {
  const now = new Date();
  const document = await readLearningDocument();
  const card = findCard(document, problem.frontendId) ?? createCard(problem, now);
  const preview = fsrs.repeat(card.fsrs, now);
  return {
    1: preview[1].card.scheduled_days,
    2: preview[2].card.scheduled_days,
    3: preview[3].card.scheduled_days,
    4: preview[4].card.scheduled_days,
  };
}
