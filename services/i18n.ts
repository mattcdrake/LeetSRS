import { storage } from '#imports';
import { detectBrowserLanguage, type Translations, translations } from '@/shared/i18n';
import type { Language } from '@/shared/settings';
import { STORAGE_KEYS } from './storage-keys';

// Service translations - cached and updated via storage watcher
const detectedLanguage = detectBrowserLanguage();
let cachedTranslations: Translations = translations[detectedLanguage];

function updateTranslations(language: Language | null | undefined): void {
  const validLanguage = language && language in translations ? language : detectBrowserLanguage();
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
