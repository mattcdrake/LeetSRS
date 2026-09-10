/**
 * Centralized text strings for internationalization. All user-facing text should be defined here.
 *
 * To add a new language:
 * 1. Add the language code to SUPPORTED_LANGUAGES in domain/language.ts
 * 2. Create a translation file (e.g., `i18n/es.ts`) with `const es: Translations = { ... }`
 * 3. Import and add the translation to the `translations` record below
 * 4. Add language metadata to LANGUAGE_OPTIONS in entrypoints/popup/views/settings/LanguageSection.tsx
 * 5. Run `npm run compile` - TypeScript will catch any missing keys
 */

import type { Language } from '@/domain/language';
import de from './de';
import en from './en';
import hi from './hi';
import pl from './pl';
import zhCN from './zh-CN';

export type Translations = typeof en;

export const translations: Record<Language, Translations> = {
  de,
  en,
  hi,
  pl,
  'zh-CN': zhCN,
};
