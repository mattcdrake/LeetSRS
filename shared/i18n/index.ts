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

import type { Language } from '../settings';
import en from './en';
import hi from './hi';

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
};

// Language metadata for the dropdown UI
export const LANGUAGE_OPTIONS: Array<{
  code: Language;
  name: string;
  nativeName: string;
}> = [
  { code: 'en', name: 'English', nativeName: 'English' },
  { code: 'hi', name: 'Hindi', nativeName: 'हिन्दी' },
];
