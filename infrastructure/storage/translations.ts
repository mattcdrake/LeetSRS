import { storage } from '#imports';
import { getSupportedLanguage, type Language } from '@/domain/language';
import { type Translations, translations } from '@/i18n';
import { detectBrowserLanguage } from '@/infrastructure/browser/language';
import { STORAGE_KEYS } from './storage-keys';

export async function getStoredTranslations(): Promise<Translations> {
  const language = await storage.getItem<Language>(STORAGE_KEYS.language);
  return translations[getSupportedLanguage(language) ?? detectBrowserLanguage()];
}

// Subscribe before reading so a concurrent setting change wins over the initial read.
export function watchStoredTranslations(onChange: (t: Translations) => void, onError: (error: unknown) => void) {
  let changed = false;
  let stopped = false;
  const unwatch = storage.watch<Language>(STORAGE_KEYS.language, (language) => {
    changed = true;
    if (!stopped) onChange(translations[getSupportedLanguage(language) ?? detectBrowserLanguage()]);
  });
  void getStoredTranslations().then(
    (t) => {
      if (!stopped && !changed) onChange(t);
    },
    (error) => {
      if (!stopped && !changed) onError(error);
    }
  );
  return () => {
    stopped = true;
    unwatch();
  };
}
