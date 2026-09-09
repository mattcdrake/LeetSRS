import { z } from 'zod';

export const SUPPORTED_LANGUAGES = {
  de: true,
  en: true,
  hi: true,
  pl: true,
  'zh-CN': true,
} as const;

export const languageSchema = z.enum(Object.keys(SUPPORTED_LANGUAGES) as Array<keyof typeof SUPPORTED_LANGUAGES>, {
  error: (issue) =>
    `Unsupported language: ${String(issue.input)}. Supported languages: ${Object.keys(SUPPORTED_LANGUAGES).join(', ')}`,
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
