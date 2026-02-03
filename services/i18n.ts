import { storage } from '#imports';
import { translations, type Translations } from '@/shared/i18n';
import { STORAGE_KEYS } from './storage-keys';
import { DEFAULT_LANGUAGE, SUPPORTED_LANGUAGES, type Language } from '@/shared/settings';

// Service translations - cached and updated via storage watcher
let cachedTranslations: Translations = translations.en;
let cachedLanguage: Language = DEFAULT_LANGUAGE;

function updateTranslations(language: Language | null | undefined): void {
  const validLanguage = language && SUPPORTED_LANGUAGES.includes(language) ? language : DEFAULT_LANGUAGE;
  cachedLanguage = validLanguage;
  cachedTranslations = translations[validLanguage];
}

// Initialize translations from storage and watch for changes
(async () => {
  try {
    const language = await storage.getItem<Language>(STORAGE_KEYS.language);
    updateTranslations(language);

    // Watch for language changes
    storage.watch<Language>(STORAGE_KEYS.language, (newLanguage) => {
      updateTranslations(newLanguage);
    });
  } catch (error) {
    console.error('Failed to load language setting for services:', error);
  }
})();

/**
 * Get the current translations for use in services.
 * Translations are automatically updated when the language setting changes.
 */
export function getServiceTranslations(): Translations {
  return cachedTranslations;
}

/**
 * Get the current cached language code.
 */
export function getServiceLanguage(): Language {
  return cachedLanguage;
}
