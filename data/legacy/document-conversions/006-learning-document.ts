import type { z } from 'zod';
import { learningDocumentSchema as outputSchema } from '@/domain/learning-document';
import { outputSchema as inputSchema } from './005-combine-gist-connection';
import { assertSchema } from './schema-utils';

export { inputSchema, outputSchema };

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
