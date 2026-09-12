import type { z } from 'zod';
import { outputSchema as inputSchema } from './004-embed-notes';
import { assertSchema } from './schema-utils';

export { inputSchema };
// v5 changed connection storage only, not the learning dataset.
export const outputSchema = inputSchema;
export type Input = z.infer<typeof inputSchema>;
export type Output = z.infer<typeof outputSchema>;

export function convert(data: unknown): Output {
  assertSchema(inputSchema, data);
  const output = data;
  assertSchema(outputSchema, output);
  return output;
}
