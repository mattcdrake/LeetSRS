import { z } from 'zod';
import { type Translations, translations } from '@/shared/i18n/index';
import { detectBrowserLanguage, languageSchema } from '@/shared/settings';
import { learningDocumentItem } from '@/shared/storage';

// Content can read an old preference before background startup migrates the document.
const documentLanguageSchema = z.object({ settings: z.object({ language: languageSchema.catch('en').optional() }) });

function resolve(value: unknown): Translations {
  const language = documentLanguageSchema.safeParse(value).data?.settings.language;
  return translations[language ?? detectBrowserLanguage()];
}

async function getDocumentTranslations(): Promise<Translations> {
  return resolve(await learningDocumentItem.getValue());
}

// Subscribe before reading so a concurrent change wins over the initial read.
export function watchDocumentTranslations(onChange: (t: Translations) => void, onError?: (error: unknown) => void) {
  let changed = false;
  let stopped = false;
  const unwatch = learningDocumentItem.watch((value) => {
    changed = true;
    if (!stopped) {
      onChange(resolve(value));
    }
  });
  void getDocumentTranslations().then(
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
