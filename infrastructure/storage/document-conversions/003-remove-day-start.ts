import { z } from 'zod';
import { assertSchema } from './schema-utils';
import { datasetV2Schema as inputSchema, datasetV3Schema as outputSchema } from './schemas';

export { inputSchema, outputSchema };
export type Input = z.infer<typeof inputSchema>;
export type Output = z.infer<typeof outputSchema>;

export function convert(data: unknown): Output {
  assertSchema(inputSchema, data);
  const output = { ...data };
  if (data.settings !== undefined) {
    const { dayStartHour: _retired, autoClearLeetcode, ...settings } = data.settings;
    if (settings.resetEditorOnEveryProblem === undefined && autoClearLeetcode !== undefined) {
      settings.resetEditorOnEveryProblem = z.boolean().parse(autoClearLeetcode);
    }
    output.settings = settings;
  }
  assertSchema(outputSchema, output);
  return output;
}
