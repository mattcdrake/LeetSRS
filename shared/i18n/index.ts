/**
 * Centralized text strings for internationalization. All user-facing text should be defined here.
 *
 * To add a new language:
 * 1. Add the language code to the Language type in shared/settings.ts
 * 2. Create a translation file (e.g., `shared/i18n/es.ts`) with `const es: Translations = { ... }`
 * 3. Import and add the translation to the `translations` record below
 * 4. Add language metadata to LANGUAGE_OPTIONS below
 * 5. Run `npm run compile` - TypeScript will catch any missing keys
 */

import { DEFAULT_LANGUAGE, type Language } from '../settings';
import en from './en';
import hi from './hi';
import pl from './pl';
import zhCN from './zh-CN';

// Helper type to widen literal string types to string while preserving structure and functions
type DeepStringify<T> = T extends (...args: infer A) => infer R
  ? (...args: A) => R
  : T extends object
    ? { [K in keyof T]: DeepStringify<T[K]> }
    : T extends string
      ? string
      : T;

// Type for translations - all languages must match this structure
export type Translations = DeepStringify<typeof en>;

// All translations keyed by language code
export const translations: Record<Language, Translations> = {
  en,
  hi,
  pl,
  'zh-CN': zhCN,
};

// Language metadata for the dropdown UI
export const LANGUAGE_OPTIONS: Array<{
  code: Language;
  name: string;
  nativeName: string;
}> = [
  { code: 'en', name: 'English', nativeName: 'English' },
  { code: 'hi', name: 'Hindi', nativeName: 'हिन्दी' },
  { code: 'pl', name: 'Polish', nativeName: 'Polski' },
  { code: 'zh-CN', name: 'Chinese (Simplified)', nativeName: '简体中文' },
];

/**
 * Detect the best matching supported language from the browser's language preferences.
 * Checks navigator.languages in preference order: exact match, then base language, then zh variants → zh-CN.
 * Falls back to DEFAULT_LANGUAGE if no match found.
 */
export function detectBrowserLanguage(): Language {
  const browserLanguages = typeof navigator !== 'undefined' ? navigator.languages : [];

  for (const browserLang of browserLanguages) {
    // Exact match (e.g. "zh-CN" → "zh-CN", "en" → "en")
    if (browserLang in translations) {
      return browserLang as Language;
    }

    // Base language match (e.g. "en-US" → "en", "pl-PL" → "pl")
    const baseLang = browserLang.split('-')[0];
    if (baseLang in translations) {
      return baseLang as Language;
    }

    // zh variants → zh-CN (e.g. "zh", "zh-TW", "zh-HK")
    if (baseLang === 'zh') {
      return 'zh-CN';
    }
  }

  return DEFAULT_LANGUAGE;
}
