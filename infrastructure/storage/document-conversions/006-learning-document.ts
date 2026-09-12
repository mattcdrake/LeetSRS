import type { z } from 'zod';
import { learningDocumentSchema as outputSchema } from '@/domain/learning-document';
import { assertSchema } from './schema-utils';
import { datasetV5Schema as inputSchema } from './schemas';

export { inputSchema, outputSchema };
export type Input = z.infer<typeof inputSchema>;
export type Output = z.infer<typeof outputSchema>;

export function convert(data: unknown): Output {
  assertSchema(inputSchema, data);
  return outputSchema.parse({
    schemaVersion: 6,
    ...(data.dataUpdatedAt !== undefined && { dataUpdatedAt: data.dataUpdatedAt }),
    cards: data.cards ?? {},
    stats: data.stats ?? {},
    settings: data.settings ?? {},
  });
}
