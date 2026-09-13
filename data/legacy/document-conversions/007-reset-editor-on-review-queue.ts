import { z } from 'zod';
import { outputSchema as inputSchema } from './006-learning-document';
import { assertSchema } from './schema-utils';

export { inputSchema };

// Frozen v7 document contract. Never import the evolving current document schema here.
const settingsSchema = z
  .object({
    maxNewCardsPerDay: z.number().int().min(0).max(100),
    theme: z.enum(['system', 'light', 'dark']),
    resetEditorOnReviewQueue: z.boolean(),
    badgeEnabled: z.boolean(),
    language: z.enum(['de', 'en', 'hi', 'pl', 'zh-CN']),
  })
  .partial();

export const outputSchema = inputSchema
  .extend({
    schemaVersion: z.literal(7),
    settings: settingsSchema,
  })
  .superRefine(({ cards, stats }, ctx) => {
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

    for (const [date, entry] of Object.entries(stats)) {
      if (entry.date !== date) {
        ctx.addIssue({ code: 'custom', message: `Stats date does not match key: ${date}`, path: ['stats', date] });
      }
    }
  });

export type Input = z.infer<typeof inputSchema>;
export type Output = z.infer<typeof outputSchema>;

export function convert(data: unknown): Output {
  assertSchema(inputSchema, data);

  const { resetEditorOnReviewQueue, resetEditorOnEveryProblem, resetEditorOnDueReview, ...remainingSettings } =
    data.settings;
  const migratedResetSetting =
    resetEditorOnReviewQueue === undefined
      ? Boolean(resetEditorOnEveryProblem || resetEditorOnDueReview)
      : z.boolean().parse(resetEditorOnReviewQueue);

  return outputSchema.parse({
    ...data,
    schemaVersion: 7,
    settings: {
      ...remainingSettings,
      resetEditorOnReviewQueue: migratedResetSetting,
    },
  });
}
