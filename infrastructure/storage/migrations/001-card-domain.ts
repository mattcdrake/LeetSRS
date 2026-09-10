import { z } from 'zod';
import { storage } from '#imports';
import type { Migration } from './contract';
import { loadLegacyData } from './legacy-storage';

// This is the v0 shape, deliberately independent of today's Card schema.
const datasetSchema = z.looseObject({ cards: z.record(z.string(), z.unknown()).nullish() });
// Only object cards gain a domain. Other JSON records and truthy historical domains remain unchanged.
const migratedCardSchema = z.union([
  z.looseObject({ domain: z.custom<NonNullable<unknown>>((domain) => Boolean(domain)) }),
  z.string(),
  z.number(),
  z.boolean(),
  z.null(),
  z.array(z.unknown()),
]);

type InputDataset = z.infer<typeof datasetSchema>;
type OutputDataset = InputDataset & {
  cards?: Record<string, z.infer<typeof migratedCardSchema>> | null;
};

function validateDataset(data: unknown): asserts data is InputDataset {
  // Use validation without the parsed copy so historical JSON keys remain intact.
  datasetSchema.parse(data);
}

function validateOutput(data: unknown): asserts data is OutputDataset {
  validateDataset(data);
  // Visit the original values: record parsing can omit legal JSON keys such as __proto__.
  for (const card of Object.values(data.cards ?? {})) migratedCardSchema.parse(card);
}

function migrate(data: unknown): OutputDataset {
  validateDataset(data);
  let output = data;
  if (data.cards) {
    output = {
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
  validateOutput(output);
  return output;
}

export const cardDomainMigration = {
  description: 'Add domain field to existing cards, defaulting to leetcode.com',
  load: loadLegacyData,
  migrate,
  save: async (data) => {
    validateOutput(data);
    const { cards } = data;
    if (cards != null) await storage.setItem('local:leetsrs:cards', cards);
  },
} satisfies Migration;
