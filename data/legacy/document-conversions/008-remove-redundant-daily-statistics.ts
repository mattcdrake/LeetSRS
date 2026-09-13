import { z } from 'zod';
import { outputSchema as inputSchema } from './007-reset-editor-on-review-queue';
import { assertSchema } from './schema-utils';

export { inputSchema };

// Frozen v8 document contract. Never import the evolving current document schema here.
const count = z.int().nonnegative();
const statisticsDateSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/)
  .refine((value) => {
    const date = new Date(value);
    return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value;
  });
const dailyStatsSchema = z.object({
  newCards: count,
  streak: count,
  gradeBreakdown: z.object({ 1: count, 2: count, 3: count, 4: count }),
});

export const outputSchema = z
  .object({
    schemaVersion: z.literal(8),
    dataUpdatedAt: inputSchema.shape.dataUpdatedAt,
    cards: inputSchema.shape.cards,
    stats: z.record(statisticsDateSchema, dailyStatsSchema),
    settings: inputSchema.shape.settings,
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

export type Input = z.infer<typeof inputSchema>;
export type Output = z.infer<typeof outputSchema>;

export function convert(data: unknown): Output {
  assertSchema(inputSchema, data);

  const stats = Object.fromEntries(
    Object.entries(data.stats).map(([date, { newCards, streak, gradeBreakdown }]) => [
      date,
      { newCards, streak, gradeBreakdown },
    ])
  );

  return outputSchema.parse({ ...data, schemaVersion: 8, stats });
}
