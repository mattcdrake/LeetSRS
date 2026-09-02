import { storage } from '#imports';
import { type Translations, translations } from '@/shared/i18n';
import type { Language } from '@/shared/settings';
import { STORAGE_KEYS } from './storage-keys';

const DEFAULT_LANGUAGE: Language = 'en';
let cachedTranslations: Translations | undefined;

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

export async function initializeServiceTranslations(): Promise<void> {
  const language = await storage.getItem<Language>(STORAGE_KEYS.language);
  cachedTranslations = translations[resolveLanguage(language)];
  storage.watch<Language>(STORAGE_KEYS.language, (newLanguage) => {
    cachedTranslations = translations[resolveLanguage(newLanguage)];
  });
}

/**
 * Get the current translations for use in services.
 * Translations are automatically updated when the language setting changes.
 */
export function getServiceTranslations(): Translations {
  if (!cachedTranslations) {
    throw new Error('Service translations have not been initialized');
  }
  return cachedTranslations;
}
