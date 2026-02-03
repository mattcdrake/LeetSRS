import { createContext, useContext, type ReactNode } from 'react';
import { translations, type Translations } from '@/shared/i18n';
import { useLanguageQuery } from '@/hooks/useBackgroundQueries';
import { DEFAULT_LANGUAGE } from '@/shared/settings';

const I18nContext = createContext<Translations>(translations.en);

export function I18nProvider({ children }: { children: ReactNode }) {
  const { data: language = DEFAULT_LANGUAGE } = useLanguageQuery();
  const t = translations[language];

  return <I18nContext.Provider value={t}>{children}</I18nContext.Provider>;
}

export function useI18n(): Translations {
  return useContext(I18nContext);
}
