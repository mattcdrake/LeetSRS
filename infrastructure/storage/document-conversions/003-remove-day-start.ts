import { z } from 'zod';
import { outputSchema as inputSchema } from './002-add-system-theme';
import { assertSchema } from './schema-utils';

export { inputSchema };

const retiredSettingSchema = z.never({ error: 'Migration 3 must remove retired settings' }).optional();

export const outputSchema = inputSchema.safeExtend({
  settings: inputSchema.shape.settings
    .unwrap()
    .safeExtend({ dayStartHour: retiredSettingSchema, autoClearLeetcode: retiredSettingSchema })
    .superRefine((settings, ctx) => {
      if (Object.hasOwn(settings, 'dayStartHour') || Object.hasOwn(settings, 'autoClearLeetcode')) {
        ctx.addIssue({ code: 'custom', message: 'Migration 3 must remove retired settings' });
      }
    })
    .optional(),
});

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
