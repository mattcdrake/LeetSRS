import { z } from 'zod';
import {
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
  cards: z.record(z.string(), z.looseObject({ id: z.string() })),
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
    schemaVersion < FIRST_DOCUMENT_VERSION ? { cards: {}, stats: {}, settings: {}, ...data } : data
  );
  const notes = schemaVersion < 4 && data.notes !== undefined ? legacyNotesSchema.parse(data.notes) : {};
  const convertedCards = Object.fromEntries(
    Object.entries(cards).map(([slug, card]) => {
      const converted = { ...card };
      if (schemaVersion === 0 && card.domain === undefined) {
        converted.domain = 'leetcode.com';
      }
      if (schemaVersion < 4 && card.note === undefined && Object.hasOwn(notes, card.id)) {
        converted.note = legacyNoteSchema.parse(notes[card.id]).text;
      }
      return [slug, converted];
    })
  );

  if (schemaVersion < 7 && settings.resetEditorOnReviewQueue === undefined) {
    const everyProblem =
      schemaVersion < 3 && settings.resetEditorOnEveryProblem === undefined
        ? settings.autoClearLeetcode
        : settings.resetEditorOnEveryProblem;
    const resetEveryProblem = z.boolean().default(false).parse(everyProblem);
    const resetDueReview = z.boolean().default(false).parse(settings.resetEditorOnDueReview);
    settings.resetEditorOnReviewQueue = resetEveryProblem || resetDueReview;
  }

  return learningDocumentSchema.parse({
    ...data,
    schemaVersion: LEARNING_DOCUMENT_VERSION,
    cards: convertedCards,
    reviewActivity: convertStatistics(stats),
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
