import type { z } from 'zod';
import { learningDocumentSchema as outputSchema } from '@/domain/learning-document';
import { outputSchema as inputSchema } from './007-reset-editor-on-review-queue';
import { assertSchema } from './schema-utils';

export { inputSchema, outputSchema };

export type Input = z.infer<typeof inputSchema>;
export type Output = z.infer<typeof outputSchema>;

export function convert(data: unknown): Output {
  assertSchema(inputSchema, data);

  const stats = Object.fromEntries(
    Object.entries(data.stats).map(([date, { newCards, streak, gradeBreakdown }]) => [
      date,
      { newCards, streak, gradeBreakdown },
    ])
  );

  return outputSchema.parse({ ...data, schemaVersion: 8, stats });
}
