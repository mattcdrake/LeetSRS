import type { Language } from '@/domain/settings';
import { translations } from './index';

const DEFAULT_LANGUAGE: Language = 'en';

export function selectLanguage(browserLanguages: readonly string[]): Language {
  for (const browserLanguage of browserLanguages) {
    if (browserLanguage in translations) {
      return browserLanguage as Language;
    }

    const baseLanguage = browserLanguage.split('-')[0];
    if (baseLanguage in translations) {
      return baseLanguage as Language;
    }
    if (baseLanguage === 'zh') {
      return 'zh-CN';
    }
  }

  return DEFAULT_LANGUAGE;
}

export function getSupportedLanguage(language: unknown): Language | undefined {
  return typeof language === 'string' && language in translations ? (language as Language) : undefined;
}
