import { storage } from '#imports';
import type { Language } from '@/domain/settings';
import { detectBrowserLanguage } from '@/infrastructure/browser/language';
import { type Translations, translations } from '@/shared/i18n';
import { getSupportedLanguage } from '@/shared/i18n/language';
import { STORAGE_KEYS } from './storage-keys';

export async function getStoredTranslations(): Promise<Translations> {
  const language = await storage.getItem<Language>(STORAGE_KEYS.language);
  return translations[getSupportedLanguage(language) ?? detectBrowserLanguage()];
}
