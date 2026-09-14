import { z } from 'zod';
import type { LearningDocument } from '@/shared/models';

export const SUPPORTED_LANGUAGES = ['de', 'en', 'hi', 'pl', 'zh-CN'] as const;

export const languageSchema = z.enum(SUPPORTED_LANGUAGES, {
  error: (issue) =>
    `Unsupported language: ${String(issue.input)}. Supported languages: ${SUPPORTED_LANGUAGES.join(', ')}`,
});
export type Language = z.infer<typeof languageSchema>;

const DEFAULT_LANGUAGE: Language = 'en';

export function selectLanguage(browserLanguages: readonly string[]): Language {
  for (const browserLanguage of browserLanguages) {
    const exactMatch = getSupportedLanguage(browserLanguage);
    if (exactMatch) return exactMatch;

    const baseLanguage = browserLanguage.split('-')[0];
    const baseMatch = getSupportedLanguage(baseLanguage);
    if (baseMatch) return baseMatch;
    if (baseLanguage === 'zh') {
      return 'zh-CN';
    }
  }

  return DEFAULT_LANGUAGE;
}

export function getSupportedLanguage(language: unknown): Language | undefined {
  return languageSchema.safeParse(language).data;
}

export const SETTINGS_CONSTRAINTS = {
  maxNewCardsPerDay: { min: 0, max: 100 },
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
  theme: z.enum(['system', 'light', 'dark'], { error: 'Theme must be "system", "light", or "dark"' }),
  resetEditorOnReviewQueue: z.boolean({ error: 'Reset editor on review queue must be a boolean' }),
  badgeEnabled: z.boolean({ error: 'Badge enabled must be a boolean' }),
  language: languageSchema,
});
export type Settings = z.infer<typeof settingsSchema>;
export type Theme = Settings['theme'];

// Language defaults are resolved from browser preferences by the caller.
export const DEFAULT_SETTINGS = {
  maxNewCardsPerDay: 3,
  theme: 'system',
  resetEditorOnReviewQueue: false,
  badgeEnabled: true,
} satisfies Omit<Settings, 'language'>;

export const SETTING_KEYS = settingsSchema.keyof().options;

export function resolveSettings(overrides: Partial<Settings>, fallbackLanguage: Language): Settings {
  const entries = SETTING_KEYS.map((key) => [
    key,
    overrides[key] ?? (key === 'language' ? fallbackLanguage : DEFAULT_SETTINGS[key]),
  ]);
  return settingsSchema.parse(Object.fromEntries(entries));
}

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

export function detectBrowserLanguage(): Language {
  const browserLanguages = typeof navigator !== 'undefined' ? navigator.languages : [];
  return selectLanguage(browserLanguages);
}

export function resolveLearningDocumentSettings(document: LearningDocument): Settings {
  return resolveSettings(document.settings, document.settings.language ?? detectBrowserLanguage());
}
