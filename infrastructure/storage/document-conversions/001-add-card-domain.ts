import type { z } from 'zod';
import { assertSchema } from './schema-utils';
import { datasetV0Schema as inputSchema, datasetV1Schema as outputSchema } from './schemas';

export { inputSchema, outputSchema };
export type Input = z.infer<typeof inputSchema>;
export type Output = z.infer<typeof outputSchema>;

export function convert(data: unknown): Output {
  assertSchema(inputSchema, data);
  const output =
    data.cards === undefined
      ? data
      : {
          ...data,
          cards: Object.fromEntries(
            Object.entries(data.cards).map(([slug, card]) => [slug, { ...card, domain: card.domain || 'leetcode.com' }])
          ),
        };
  assertSchema(outputSchema, output);
  return output;
}
