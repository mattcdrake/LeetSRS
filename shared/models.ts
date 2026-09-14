import { type CardInput, type Grade, Rating } from 'ts-fsrs';
import { z } from 'zod';
import { settingsSchema } from '@/shared/settings';

export const ratingSchema = z.literal([Rating.Again, Rating.Hard, Rating.Good, Rating.Easy]) satisfies z.ZodType<Grade>;
export type ReviewRating = z.infer<typeof ratingSchema>;

export const NOTES_MAX_LENGTH = 500;
export const noteTextSchema = z.string().max(NOTES_MAX_LENGTH, {
  error: `Note exceeds maximum length of ${NOTES_MAX_LENGTH} characters`,
});

const nonemptyString = z.string().refine((value) => value.trim().length > 0, {
  message: 'Must contain at least one non-whitespace character',
});
const count = z.int().nonnegative();
const epochMilliseconds = z.number().min(-8.64e15).max(8.64e15);

export const difficultySchema = z.enum(['Easy', 'Medium', 'Hard']);
export const leetcodeDomainSchema = z.enum(['leetcode.com', 'leetcode.cn']);
export const problemDescriptorSchema = z.object({
  slug: nonemptyString,
  name: nonemptyString,
  leetcodeId: nonemptyString,
  difficulty: difficultySchema,
  domain: leetcodeDomainSchema,
});

export const fsrsCardSchema = z.object({
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

export const cardSchema = problemDescriptorSchema
  .extend({
    id: nonemptyString,
    createdAt: epochMilliseconds,
    fsrs: fsrsCardSchema,
    paused: z.boolean(),
    note: noteTextSchema.optional(),
  })
  .transform((card) => {
    if (card.note === '') delete card.note;
    return card;
  });

export type Difficulty = z.infer<typeof difficultySchema>;
export type LeetcodeDomain = z.infer<typeof leetcodeDomainSchema>;
export type ProblemDescriptor = z.infer<typeof problemDescriptorSchema>;
export const rateCardInputSchema = problemDescriptorSchema.extend({ rating: ratingSchema });
export type RateCardInput = z.infer<typeof rateCardInputSchema>;
export type FsrsCard = z.infer<typeof fsrsCardSchema>;
export type Card = z.infer<typeof cardSchema>;
export const dailyStatsSchema = z.object({
  newCards: count,
  streak: count,
  gradeBreakdown: z.object({
    [Rating.Again]: count,
    [Rating.Hard]: count,
    [Rating.Good]: count,
    [Rating.Easy]: count,
  }),
});
export type DailyStats = z.infer<typeof dailyStatsSchema>;

export const LEARNING_DOCUMENT_VERSION = 8;

export const learningDocumentVersionSchema = z.object({ schemaVersion: z.int().nonnegative() });
const statisticsDateSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/)
  .refine((value) => {
    const date = new Date(value);
    return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value;
  });

export const learningDocumentSchema = z
  .object({
    schemaVersion: z.literal(LEARNING_DOCUMENT_VERSION),
    dataUpdatedAt: z
      .string()
      .refine((value) => Number.isFinite(Date.parse(value)))
      .optional(),
    cards: z.record(z.string(), cardSchema),
    stats: z.record(statisticsDateSchema, dailyStatsSchema),
    settings: settingsSchema.partial(),
  })
  .superRefine(({ cards }, ctx) => {
    const ids = new Set<string>();

    for (const [slug, card] of Object.entries(cards)) {
      if (card.slug !== slug) {
        ctx.addIssue({ code: 'custom', message: `Card slug does not match key: ${slug}`, path: ['cards', slug] });
      }

      if (ids.has(card.id)) {
        ctx.addIssue({ code: 'custom', message: `Duplicate card ID: ${card.id}`, path: ['cards', slug, 'id'] });
      }

      ids.add(card.id);
    }
  });

export type LearningDocument = z.infer<typeof learningDocumentSchema>;

export function findCard(document: LearningDocument, slug: string): Card | undefined {
  if (Object.hasOwn(document.cards, slug)) {
    return document.cards[slug];
  }
  return undefined;
}

export const gistSyncConfigSchema = z.object({
  pat: z.string(),
  gistId: z.string().nullable(),
  enabled: z.boolean(),
});
export type GistSyncConfig = z.infer<typeof gistSyncConfigSchema>;

export const gistSetupSchema = z.discriminatedUnion('mode', [
  z.object({ mode: z.literal('existing'), pat: z.string().trim().min(1), gistId: z.string().trim().min(1) }),
  z.object({ mode: z.literal('create'), pat: z.string().trim().min(1) }),
]);
export type GistSetup = z.infer<typeof gistSetupSchema>;

export type GistSyncErrorCode =
  | 'authentication'
  | 'connectionSaveFailed'
  | 'creationFailed'
  | 'gistNotFound'
  | 'missingBackup'
  | 'missingGist'
  | 'missingToken'
  | 'rateLimit'
  | 'unavailable'
  | 'unknown';

export type GistConnectionResult = { saved: true } | { saved: false; error: GistSyncErrorCode };

export interface GistSyncStatus {
  lastSyncTime: string | null;
  lastSyncDirection: 'push' | 'pull' | null;
  syncInProgress: boolean;
  lastError: GistSyncErrorCode | null;
}

export function createEmptyDailyStats(streak: number): DailyStats {
  return {
    gradeBreakdown: {
      [Rating.Again]: 0,
      [Rating.Hard]: 0,
      [Rating.Good]: 0,
      [Rating.Easy]: 0,
    },
    newCards: 0,
    streak,
  };
}
