import { type Language, selectLanguage } from '@/domain/language';

export function detectBrowserLanguage(): Language {
  const browserLanguages = typeof navigator !== 'undefined' ? navigator.languages : [];
  return selectLanguage(browserLanguages);
}

export function resolveLanguage(preferred?: Language): Language {
  return preferred ?? detectBrowserLanguage();
}
