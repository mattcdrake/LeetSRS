import { storage } from '#imports';
import { detectBrowserLanguage, translations, type Translations } from '@/shared/i18n';
import { STORAGE_KEYS } from './storage-keys';
import { type Language } from '@/shared/settings';

// Service translations - cached and updated via storage watcher
const detectedLanguage = detectBrowserLanguage();
let cachedTranslations: Translations = translations[detectedLanguage];
let cachedLanguage: Language = detectedLanguage;

function updateTranslations(language: Language | null | undefined): void {
  const validLanguage = language && language in translations ? language : detectBrowserLanguage();
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
