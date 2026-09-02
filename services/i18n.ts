import { storage } from '#imports';
import { type Translations, translations } from '@/shared/i18n';
import type { Language } from '@/shared/settings';
import { STORAGE_KEYS } from './storage-keys';

const DEFAULT_LANGUAGE: Language = 'en';

export function detectBrowserLanguage(): Language {
  const browserLanguages = typeof navigator !== 'undefined' ? navigator.languages : [];

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

function resolveLanguage(language: unknown): Language {
  return typeof language === 'string' && language in translations ? (language as Language) : detectBrowserLanguage();
}

export async function getServiceTranslations(): Promise<Translations> {
  const language = await storage.getItem<Language>(STORAGE_KEYS.language);
  return translations[resolveLanguage(language)];
}
