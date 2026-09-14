import { z } from 'zod';
import { type Card, cardSchema } from './cards';
import { settingsSchema } from './settings';
import { dailyStatsSchema } from './statistics';

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
