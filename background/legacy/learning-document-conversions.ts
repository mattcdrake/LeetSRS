import { z } from 'zod';
import {
  cardSchema,
  LEARNING_DOCUMENT_VERSION,
  type LearningDocument,
  learningDocumentSchema,
  learningDocumentVersionSchema,
  reviewActivitySchema,
} from '@/shared/models';

const FIRST_DOCUMENT_VERSION = 6;
const versionedInputSchema = learningDocumentVersionSchema.loose().extend({
  schemaVersion: learningDocumentVersionSchema.shape.schemaVersion.default(0),
});

// Only describe the structure needed for translation. The current schema validates retained data.
const legacyCollectionsSchema = z.object({
  cards: z.record(z.string(), z.unknown()),
  stats: z.record(z.string(), z.unknown()),
  settings: z.record(z.string(), z.unknown()),
});
const legacyNotesSchema = z.record(z.string(), z.unknown());
const legacyNoteSchema = z.object({ text: z.string() });
const legacyBackupSchema = z.looseObject({
  data: z.looseObject({
    cards: legacyCollectionsSchema.shape.cards,
    stats: legacyCollectionsSchema.shape.stats,
  }),
});

// Accepts an in-memory legacy installation or an already-versioned document.
export function convertLearningDocument(input: unknown): LearningDocument {
  const { schemaVersion, ...data } = versionedInputSchema.parse(input);

  if (schemaVersion > LEARNING_DOCUMENT_VERSION) {
    throw new Error(`Unsupported schema version: ${schemaVersion}`);
  }
  if (schemaVersion === LEARNING_DOCUMENT_VERSION) {
    return learningDocumentSchema.parse(input);
  }

  const { cards, stats, settings } = legacyCollectionsSchema.parse(
    schemaVersion < FIRST_DOCUMENT_VERSION
      ? { cards: {}, stats: {}, settings: {}, ...data }
      : { ...data, ...(schemaVersion >= 9 && { stats: {} }) }
  );
  let convertedCards = Object.values(cards).flatMap((value) => {
    const parsed = z.looseObject({}).safeParse(value);
    return parsed.success ? [parsed.data] : [];
  });

  if (schemaVersion < 1) {
    for (const card of convertedCards) {
      if (card.domain === undefined) card.domain = 'leetcode.com';
    }
  }

  if (schemaVersion < 3) {
    if (settings.resetEditorOnEveryProblem === undefined) {
      settings.resetEditorOnEveryProblem = settings.autoClearLeetcode;
    }
  }

  if (schemaVersion < 4) {
    const notes = data.notes === undefined ? {} : legacyNotesSchema.parse(data.notes);
    convertedCards = convertedCards.flatMap((card) => {
      if (card.note === undefined && typeof card.id === 'string' && Object.hasOwn(notes, card.id)) {
        const note = legacyNoteSchema.safeParse(notes[card.id]);
        if (!note.success) return [];
        card.note = note.data.text;
      }
      return [card];
    });
  }

  if (schemaVersion < 7) {
    if (settings.resetEditorOnReviewQueue === undefined) {
      const resetEveryProblem = z.boolean().default(false).parse(settings.resetEditorOnEveryProblem);
      const resetDueReview = z.boolean().default(false).parse(settings.resetEditorOnDueReview);
      settings.resetEditorOnReviewQueue = resetEveryProblem || resetDueReview;
    }
  }

  if (schemaVersion < 9) {
    data.reviewActivity = convertStatistics(stats);
  }

  if (schemaVersion < 10) {
    data.cards = Object.fromEntries(
      convertedCards.flatMap((card) => {
        const result = cardSchema.safeParse({ ...card, frontendId: card.leetcodeId });
        return result.success ? [[result.data.frontendId, result.data]] : [];
      })
    );
  }

  if (schemaVersion < 11) {
    if (settings.language === 'de' || settings.language === 'hi' || settings.language === 'pl') {
      settings.language = 'en';
    }
  }

  return learningDocumentSchema.parse({
    ...data,
    schemaVersion: LEARNING_DOCUMENT_VERSION,
    settings,
  });
}

function convertStatistics(stats: Record<string, unknown>) {
  let latest: LearningDocument['reviewActivity'] = null;
  for (const [date, value] of Object.entries(stats)) {
    const counts = reviewActivitySchema.omit({ date: true }).parse(value);
    const activity = reviewActivitySchema.parse({ ...counts, date });
    if (!latest || activity.date > latest.date) latest = activity;
  }
  return latest;
}

export function parseLearningDocumentBackup(json: string): LearningDocument {
  let decodedBackup: unknown;

  try {
    decodedBackup = JSON.parse(json);
  } catch {
    throw new Error('Invalid JSON format');
  }

  const { schemaVersion } = versionedInputSchema.parse(decodedBackup);
  if (schemaVersion >= FIRST_DOCUMENT_VERSION) {
    return convertLearningDocument(decodedBackup);
  }

  const { data, dataUpdatedAt, exportDate } = legacyBackupSchema.parse(decodedBackup);
  return convertLearningDocument({
    ...data,
    schemaVersion,
    dataUpdatedAt: dataUpdatedAt === undefined ? exportDate : dataUpdatedAt,
  });
}
