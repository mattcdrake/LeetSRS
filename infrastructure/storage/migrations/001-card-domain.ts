import { z } from 'zod';
import { storage } from '#imports';
import type { Migration } from './contract';
import { loadLegacyData } from './legacy-storage';

// This is the v0 shape, deliberately independent of today's Card schema.
const datasetSchema = z.looseObject({ cards: z.record(z.string(), z.unknown()).nullish() });

export function migrate(data: unknown): unknown {
  const dataset = datasetSchema.parse(data);
  if (!dataset.cards) return dataset;
  return {
    ...dataset,
    cards: Object.fromEntries(
      Object.entries(dataset.cards).map(([slug, card]) => {
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
    const { cards } = datasetSchema.parse(data);
    if (cards != null) await storage.setItem('local:leetsrs:cards', cards);
  },
};
