import type { Language } from '@/domain/settings';
import { selectLanguage } from '@/shared/i18n/language';

export function detectBrowserLanguage(): Language {
  const browserLanguages = typeof navigator !== 'undefined' ? navigator.languages : [];
  return selectLanguage(browserLanguages);
}
