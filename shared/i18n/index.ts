/**
 * Centralized text strings for internationalization. All user-facing text should be defined here.
 *
 * To add a new language:
 * 1. Add the language code to the Language type in shared/settings.ts
 * 2. Create a translation file (e.g., `shared/i18n/es.ts`) with `const es: Translations = { ... }`
 * 3. Import and add the translation to the `translations` record below
 * 4. Add language metadata to LANGUAGE_OPTIONS in entrypoints/popup/views/settings/LanguageSection.tsx
 * 5. Run `npm run compile` - TypeScript will catch any missing keys
 */

import type { Language } from '../settings';
import de from './de';
import en from './en';
import hi from './hi';
import pl from './pl';
import zhCN from './zh-CN';

type DeepStringify<T> = T extends (...args: infer A) => infer R
  ? (...args: A) => R
  : T extends object
    ? { [K in keyof T]: DeepStringify<T[K]> }
    : T extends string
      ? string
      : T;

export type Translations = DeepStringify<typeof en>;

export const translations: Record<Language, Translations> = {
  de,
  en,
  hi,
  pl,
  'zh-CN': zhCN,
};
