import { z } from 'zod';
import { storage } from '#imports';
import type { Migration } from './contract';
import { loadLegacyData } from './legacy-storage';

// This is the v0 shape, deliberately independent of today's Card schema.
const datasetSchema = z.looseObject({ cards: z.record(z.string(), z.unknown()).nullish() });

function validateDataset(data: unknown): asserts data is z.infer<typeof datasetSchema> {
  // Use validation without the parsed copy so historical JSON keys remain intact.
  datasetSchema.parse(data);
}

function migrate(data: unknown): unknown {
  validateDataset(data);
  if (!data.cards) return data;
  return {
    ...data,
    cards: Object.fromEntries(
      Object.entries(data.cards).map(([slug, card]) => {
        // Preserve malformed records for later validation. Repair only falsy/missing domains.
        if (typeof card !== 'object' || card === null || Array.isArray(card)) return [slug, card];
        if ('domain' in card && card.domain) return [slug, card];
        return [slug, { ...card, domain: 'leetcode.com' }];
      })
    ),
  };
}

export const cardDomainMigration: Migration = {
  description: 'Add domain field to existing cards, defaulting to leetcode.com',
  load: loadLegacyData,
  migrate,
  save: async (data) => {
    validateDataset(data);
    const { cards } = data;
    if (cards != null) await storage.setItem('local:leetsrs:cards', cards);
  },
};
