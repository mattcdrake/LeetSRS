import { z } from 'zod';
import { assertSchema, recordSchema } from './schema-utils';

// Frozen historical learning datasets. Never import evolving domain schemas here.
// Fields absent from an installation stay absent until the v6 document conversion.
const nonemptyString = z.string().refine((value) => value.trim().length > 0);
const count = z.int().nonnegative();
const epochMilliseconds = z.number().min(-8.64e15).max(8.64e15);
const leetcodeDomainSchema = z.enum(['leetcode.com', 'leetcode.cn']);

export const noteTextSchema = z.string().max(500, { error: 'Note exceeds maximum length of 500 characters' });
export const legacyNoteSchema = z.looseObject({ text: noteTextSchema });
export const timestampSchema = z.string().refine((value) => Number.isFinite(Date.parse(value)));

const fsrsSchema = z.looseObject({
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
});

const cardV0Schema = z.looseObject({
  id: nonemptyString,
  slug: nonemptyString,
  name: nonemptyString,
  leetcodeId: nonemptyString,
  difficulty: z.enum(['Easy', 'Medium', 'Hard']),
  domain: z.union([leetcodeDomainSchema, z.literal(''), z.literal(0), z.literal(false), z.null()]).optional(),
  createdAt: epochMilliseconds,
  fsrs: fsrsSchema,
  paused: z.boolean(),
  // Early embedded notes can occur after an interrupted legacy migration.
  note: noteTextSchema.optional(),
});

const cardV1Schema = cardV0Schema.extend({ domain: leetcodeDomainSchema });

const calendarDateSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/)
  .refine((value) => {
    const date = new Date(value);

    return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value;
  });

const statsSchema = z.looseObject({
  date: calendarDateSchema,
  totalReviews: count,
  newCards: count,
  reviewedCards: count,
  streak: count,
  gradeBreakdown: z.looseObject({ 1: count, 2: count, 3: count, 4: count }),
});

const settingsSchema = z
  .looseObject({
    maxNewCardsPerDay: z.number().int().min(0).max(100),
    theme: z.enum(['system', 'light', 'dark'], { error: 'Theme must be "system", "light", or "dark"' }),
    resetEditorOnEveryProblem: z.boolean({ error: 'Editor-reset setting must be a boolean' }),
    resetEditorOnDueReview: z.boolean(),
    badgeEnabled: z.boolean(),
    language: z.enum(['de', 'en', 'hi', 'pl', 'zh-CN']),
  })
  .partial();

const legacySettingsSchema = settingsSchema
  .extend({
    // Retired values are discarded, and a modern reset preference wins over the old one.
    dayStartHour: z.unknown().optional(),
    autoClearLeetcode: z.unknown().optional(),
  })
  .superRefine((settings, ctx) => {
    if (
      settings.resetEditorOnEveryProblem === undefined &&
      settings.autoClearLeetcode !== undefined &&
      typeof settings.autoClearLeetcode !== 'boolean'
    ) {
      ctx.addIssue({ code: 'custom', path: ['autoClearLeetcode'], message: 'Editor-reset setting must be a boolean' });
    }
  });

export const inputSchema = z
  .looseObject({
    dataUpdatedAt: timestampSchema.optional(),
    cards: recordSchema(cardV0Schema).optional(),
    stats: recordSchema(statsSchema).optional(),
    settings: legacySettingsSchema.optional(),
    // Orphan notes were ignored historically; attached notes must satisfy the full note schema.
    notes: recordSchema(z.unknown()).optional(),
  })
  .superRefine(({ cards, stats, notes }, ctx) => {
    const ids = new Set<string>();

    for (const [slug, card] of Object.entries(cards ?? {})) {
      if (card.slug !== slug) {
        ctx.addIssue({ code: 'custom', path: ['cards', slug], message: `Card slug does not match key: ${slug}` });
      }

      if (ids.has(card.id)) {
        ctx.addIssue({ code: 'custom', path: ['cards', slug, 'id'], message: `Duplicate card ID: ${card.id}` });
      }

      ids.add(card.id);

      if (notes && Object.hasOwn(notes, card.id)) {
        const result = legacyNoteSchema.safeParse(notes[card.id]);

        if (!result.success) {
          for (const issue of result.error.issues) {
            ctx.addIssue({ ...issue, path: ['notes', card.id, ...issue.path] });
          }
        }
      }
    }

    for (const [date, entry] of Object.entries(stats ?? {})) {
      if (entry.date !== date) {
        ctx.addIssue({ code: 'custom', path: ['stats', date], message: `Stats date does not match key: ${date}` });
      }
    }
  });

export const outputSchema = inputSchema.safeExtend({ cards: recordSchema(cardV1Schema).optional() });

export type Input = z.infer<typeof inputSchema>;
export type Output = z.infer<typeof outputSchema>;

export function convert(data: unknown): Output {
  assertSchema(inputSchema, data);

  let output = data;

  if (data.cards !== undefined) {
    const cards = Object.fromEntries(
      Object.entries(data.cards).map(([slug, card]) => {
        const domain = card.domain || 'leetcode.com';

        return [slug, { ...card, domain }];
      })
    );

    output = { ...data, cards };
  }

  assertSchema(outputSchema, output);

  return output;
}
