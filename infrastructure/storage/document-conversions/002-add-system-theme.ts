import type { z } from 'zod';
import { assertSchema } from './schema-utils';
import { datasetV1Schema as inputSchema, datasetV2Schema as outputSchema } from './schemas';

export { inputSchema, outputSchema };
export type Input = z.infer<typeof inputSchema>;
export type Output = z.infer<typeof outputSchema>;

export function convert(data: unknown): Output {
  assertSchema(inputSchema, data);
  const output = data;
  assertSchema(outputSchema, output);
  return output;
}
