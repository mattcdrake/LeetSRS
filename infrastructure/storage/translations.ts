import { z } from 'zod';
import { storage } from '#imports';
import { languageSchema } from '@/domain/language';
import { type Translations, translations } from '@/i18n';
import { detectBrowserLanguage } from '@/infrastructure/browser/language';
import { STORAGE_KEYS, type StorageKey } from './storage-keys';

const documentLanguageSchema = z.object({ settings: z.object({ language: languageSchema.optional() }) });

// The two sources share subscription ordering until legacy removal in #379.
function createTranslationReader(key: StorageKey, selectLanguage: (value: unknown) => unknown) {
  const resolve = (value: unknown): Translations =>
    translations[languageSchema.safeParse(selectLanguage(value)).data ?? detectBrowserLanguage()];

  async function get(): Promise<Translations> {
    return resolve(await storage.getItem<unknown>(key));
  }

  // Subscribe before reading so a concurrent change wins over the initial read.
  function watch(onChange: (t: Translations) => void, onError?: (error: unknown) => void) {
    let changed = false;
    let stopped = false;
    const unwatch = storage.watch<unknown>(key, (value) => {
      changed = true;
      if (!stopped) {
        onChange(resolve(value));
      }
    });
    void get().then(
      (t) => {
        if (!stopped && !changed) {
          onChange(t);
        }
      },
      (error) => {
        if (!stopped && !changed) {
          onError?.(error);
        }
      }
    );
    return () => {
      stopped = true;
      unwatch();
    };
  }

  return { get, watch };
}

export const { get: getStoredTranslations, watch: watchStoredTranslations } = createTranslationReader(
  STORAGE_KEYS.language,
  (value) => value
);

// Prepared for content activation in #378; content remains read-only.
export const { get: getDocumentTranslations, watch: watchDocumentTranslations } = createTranslationReader(
  STORAGE_KEYS.learningDocument,
  (value) => documentLanguageSchema.safeParse(value).data?.settings.language
);
