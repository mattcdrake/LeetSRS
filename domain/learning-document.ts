import { z } from 'zod';
import { type Card, cardSchema } from './cards';
import { settingsSchema } from './settings';
import { dailyStatsSchema } from './statistics';

export const LEARNING_DOCUMENT_VERSION = 6;

export const learningDocumentSchema = z
  .object({
    schemaVersion: z.literal(LEARNING_DOCUMENT_VERSION),
    dataUpdatedAt: z
      .string()
      .refine((value) => Number.isFinite(Date.parse(value)))
      .optional(),
    cards: z.record(z.string(), cardSchema),
    stats: z.record(z.string(), dailyStatsSchema),
    settings: settingsSchema.partial(),
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

export type LearningDocument = z.infer<typeof learningDocumentSchema>;

export function findCard(document: LearningDocument, slug: string): Card | undefined {
  if (Object.hasOwn(document.cards, slug)) {
    return document.cards[slug];
  }
  return undefined;
}
