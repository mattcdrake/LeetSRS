import type { z } from 'zod';
import { outputSchema as inputSchema } from './001-add-card-domain';
import { assertSchema } from './schema-utils';

export { inputSchema };
// v2 changed the default theme, not stored learning data.
export const outputSchema = inputSchema;
export type Input = z.infer<typeof inputSchema>;
export type Output = z.infer<typeof outputSchema>;

export function convert(data: unknown): Output {
  assertSchema(inputSchema, data);
  const output = data;
  assertSchema(outputSchema, output);
  return output;
}
