import { storage } from '#imports';
import { getSupportedLanguage, type Language } from '@/domain/language';
import { type Translations, translations } from '@/i18n';
import { detectBrowserLanguage } from '@/infrastructure/browser/language';
import { STORAGE_KEYS } from './storage-keys';

export async function getStoredTranslations(): Promise<Translations> {
  const language = await storage.getItem<Language>(STORAGE_KEYS.language);
  return translations[getSupportedLanguage(language) ?? detectBrowserLanguage()];
}
