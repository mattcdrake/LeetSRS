import { z } from 'zod';
import { outputSchema as inputSchema } from '@/background/legacy/document-conversions/005-combine-gist-connection';
import { assertSchema } from '@/background/legacy/document-conversions/schema-utils';

export { inputSchema };

// Frozen v6 document contract. Never import the evolving current document schema here.
export const outputSchema = z.object({
  schemaVersion: z.literal(6),
  dataUpdatedAt: inputSchema.shape.dataUpdatedAt,
  cards: inputSchema.shape.cards.unwrap(),
  stats: inputSchema.shape.stats.unwrap(),
  settings: inputSchema.shape.settings.unwrap(),
});

export type Input = z.infer<typeof inputSchema>;
export type Output = z.infer<typeof outputSchema>;

export function convert(data: unknown): Output {
  assertSchema(inputSchema, data);

  const document: Output = {
    schemaVersion: 6,
    cards: data.cards ?? {},
    stats: data.stats ?? {},
    settings: data.settings ?? {},
  };

  if (data.dataUpdatedAt !== undefined) {
    document.dataUpdatedAt = data.dataUpdatedAt;
  }

  return outputSchema.parse(document);
}
