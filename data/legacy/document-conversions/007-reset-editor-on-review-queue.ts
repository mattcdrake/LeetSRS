import { z } from 'zod';
import { learningDocumentSchema as outputSchema } from '@/domain/learning-document';
import { outputSchema as inputSchema } from './006-learning-document';
import { assertSchema } from './schema-utils';

export { inputSchema, outputSchema };

export type Input = z.infer<typeof inputSchema>;
export type Output = z.infer<typeof outputSchema>;

export function convert(data: unknown): Output {
  assertSchema(inputSchema, data);

  const { resetEditorOnReviewQueue, resetEditorOnEveryProblem, resetEditorOnDueReview, ...remainingSettings } =
    data.settings;
  const migratedResetSetting =
    resetEditorOnReviewQueue === undefined
      ? Boolean(resetEditorOnEveryProblem || resetEditorOnDueReview)
      : z.boolean().parse(resetEditorOnReviewQueue);

  return outputSchema.parse({
    ...data,
    schemaVersion: 7,
    settings: {
      ...remainingSettings,
      resetEditorOnReviewQueue: migratedResetSetting,
    },
  });
}
