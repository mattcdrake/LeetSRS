export const SUPPORTED_LANGUAGES = {
  de: true,
  en: true,
  hi: true,
  pl: true,
  'zh-CN': true,
} as const;

export type Language = keyof typeof SUPPORTED_LANGUAGES;

const DEFAULT_LANGUAGE: Language = 'en';

export function selectLanguage(browserLanguages: readonly string[]): Language {
  for (const browserLanguage of browserLanguages) {
    if (browserLanguage in SUPPORTED_LANGUAGES) {
      return browserLanguage as Language;
    }

    const baseLanguage = browserLanguage.split('-')[0];
    if (baseLanguage in SUPPORTED_LANGUAGES) {
      return baseLanguage as Language;
    }
    if (baseLanguage === 'zh') {
      return 'zh-CN';
    }
  }

  return DEFAULT_LANGUAGE;
}

export function getSupportedLanguage(language: unknown): Language | undefined {
  return typeof language === 'string' && language in SUPPORTED_LANGUAGES ? (language as Language) : undefined;
}
