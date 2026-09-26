import { type CardInput, type Grade, Rating } from 'ts-fsrs';
import { z } from 'zod';
import { storage } from '#imports';
import { background } from '@/shared/background-service';
import { leetcodeDomainSchema } from '@/shared/leetcode-domain';
import { roadmapIdSchema, roadmapSkipsSchema } from '@/shared/roadmap';
import { settingsSchema } from '@/shared/settings';

export const ratingSchema = z.literal([Rating.Again, Rating.Hard, Rating.Good, Rating.Easy]) satisfies z.ZodType<Grade>;

export const NOTES_MAX_LENGTH = 500;
export const noteTextSchema = z.string().max(NOTES_MAX_LENGTH, {
  error: `Note exceeds maximum length of ${NOTES_MAX_LENGTH} characters`,
});

const nonemptyString = z.string().refine((value) => value.trim().length > 0, {
  message: 'Must contain at least one non-whitespace character',
});
const count = z.int().nonnegative();
const epochMilliseconds = z.number().min(-8.64e15).max(8.64e15);

export const problemReferenceSchema = z.object({
  frontendId: nonemptyString,
  domain: leetcodeDomainSchema,
});
export type ProblemReference = z.infer<typeof problemReferenceSchema>;

const fsrsCardSchema = z.object({
  due: epochMilliseconds,
  last_review: epochMilliseconds.optional(),
  state: z.union([z.literal(0), z.literal(1), z.literal(2), z.literal(3)]),
  stability: z.number().nonnegative(),
  difficulty: z.number().nonnegative(),
  elapsed_days: z.number().nonnegative(),
  scheduled_days: z.number().nonnegative(),
  reps: count,
  lapses: count,
  learning_steps: count,
}) satisfies z.ZodType<CardInput>;

export const cardSchema = problemReferenceSchema
  .extend({
    createdAt: epochMilliseconds,
    fsrs: fsrsCardSchema,
    paused: z.boolean(),
    note: noteTextSchema.optional(),
  })
  .transform((card) => {
    if (card.note === '') delete card.note;
    return card;
  });

export const rateCardInputSchema = problemReferenceSchema.extend({ rating: ratingSchema });
export type RateCardInput = z.infer<typeof rateCardInputSchema>;
export const saveProblemInputSchema = problemReferenceSchema.extend({ rating: ratingSchema.optional() });
export type SaveProblemInput = z.infer<typeof saveProblemInputSchema>;
export type Card = z.infer<typeof cardSchema>;
export const LEARNING_DOCUMENT_VERSION = 12;

export const learningDocumentVersionSchema = z.object({ schemaVersion: z.int().nonnegative() });
const reviewDateSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/)
  .refine((value) => {
    const date = new Date(value);
    return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value;
  });

export const reviewActivitySchema = z.object({
  date: reviewDateSchema,
  newCards: count,
  streak: count,
});
export type ReviewActivity = z.infer<typeof reviewActivitySchema>;

export const learningDocumentSchema = z
  .object({
    schemaVersion: z.literal(LEARNING_DOCUMENT_VERSION),
    dataUpdatedAt: z
      .string()
      .refine((value) => Number.isFinite(Date.parse(value)))
      .optional(),
    cards: z.record(z.string(), cardSchema),
    reviewActivity: reviewActivitySchema.nullable(),
    settings: settingsSchema.partial(),
    activeRoadmapId: roadmapIdSchema.nullable(),
    roadmapSkips: roadmapSkipsSchema,
  })
  .superRefine(({ cards }, ctx) => {
    for (const [frontendId, card] of Object.entries(cards)) {
      if (card.frontendId !== frontendId) {
        ctx.addIssue({
          code: 'custom',
          message: `Card frontend ID does not match key: ${frontendId}`,
          path: ['cards', frontendId],
        });
      }
    }
  });

export type LearningDocument = z.infer<typeof learningDocumentSchema>;

export function findCard(document: LearningDocument, frontendId: string): Card | undefined {
  if (Object.hasOwn(document.cards, frontendId)) {
    return document.cards[frontendId];
  }
  return undefined;
}

export type RatingPreview = Record<Grade, number>;

export const learningDocumentItem = storage.defineItem<unknown>('local:leetsrs:learningDocument');

let backgroundReadiness: Promise<void> | undefined;

// Background readers share startup's promise; other runtimes request it through RPC.
export function setBackgroundStorageReadiness(readiness: Promise<void>): void {
  backgroundReadiness = readiness;
}

function waitForStorageInitialization(): Promise<void> {
  return backgroundReadiness ?? background.waitForInitialization();
}

export async function readLearningDocument(): Promise<LearningDocument> {
  let document = await learningDocumentItem.getValue();
  const version = learningDocumentVersionSchema.safeParse(document);
  const needsInitialization =
    document == null || (version.success && version.data.schemaVersion < LEARNING_DOCUMENT_VERSION);

  if (needsInitialization) {
    await waitForStorageInitialization();
    document = await learningDocumentItem.getValue();
  }

  if (document == null) {
    throw new Error('Learning document is not initialized');
  }

  return learningDocumentSchema.parse(document);
}

export async function replaceLearningDocument(document: LearningDocument): Promise<LearningDocument> {
  const validated = learningDocumentSchema.parse(document);

  await learningDocumentItem.setValue(validated);
  return validated;
}
