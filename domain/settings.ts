import { z } from 'zod';
import { languageSchema } from './language';

export const SETTINGS_CONSTRAINTS = {
  maxNewCardsPerDay: { min: 0, max: 100 },
  dayStartHour: { min: 0, max: 23 },
} as const;

function boundedWholeNumber(label: string, bounds: { min: number; max: number }) {
  const wholeNumberError = `${label} must be a whole number`;
  const rangeError = `${label} must be between ${bounds.min} and ${bounds.max}`;
  return z
    .number({ error: wholeNumberError })
    .refine(Number.isInteger, { error: wholeNumberError })
    .min(bounds.min, { error: rangeError })
    .max(bounds.max, { error: rangeError });
}

export const settingsSchema = z.object({
  maxNewCardsPerDay: boundedWholeNumber('Max new cards per day', SETTINGS_CONSTRAINTS.maxNewCardsPerDay),
  dayStartHour: boundedWholeNumber('Day start hour', SETTINGS_CONSTRAINTS.dayStartHour),
  theme: z.enum(['system', 'light', 'dark'], { error: 'Theme must be "system", "light", or "dark"' }),
  resetEditorOnEveryProblem: z.boolean({ error: 'Reset editor on every problem must be a boolean' }),
  resetEditorOnDueReview: z.boolean({ error: 'Reset editor on due review must be a boolean' }),
  badgeEnabled: z.boolean({ error: 'Badge enabled must be a boolean' }),
  language: languageSchema,
});
export type Settings = z.infer<typeof settingsSchema>;
export type Theme = Settings['theme'];

// Language defaults are resolved from browser preferences by the service.
export const DEFAULT_SETTINGS = {
  maxNewCardsPerDay: 3,
  dayStartHour: 0,
  theme: 'system',
  resetEditorOnEveryProblem: false,
  resetEditorOnDueReview: false,
  badgeEnabled: true,
} satisfies Omit<Settings, 'language'>;

export const SETTING_KEYS = settingsSchema.keyof().options;

// Updates use only own settings; undefined means no change.
export const settingsUpdateSchema = z.preprocess((changes) => {
  if (typeof changes !== 'object' || changes === null || Array.isArray(changes)) return changes;
  return Object.fromEntries(
    SETTING_KEYS.filter((key) => Object.hasOwn(changes, key))
      .map((key) => [key, Reflect.get(changes, key)])
      .filter(([, value]) => value !== undefined)
  );
}, settingsSchema.partial());
export type SettingsUpdate = z.infer<typeof settingsUpdateSchema>;
