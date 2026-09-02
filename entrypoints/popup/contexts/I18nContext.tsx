import { createContext, type ReactNode, useContext } from 'react';
import { useSettingsQuery } from '@/hooks/queries/settings';
import { type Translations, translations } from '@/shared/i18n';

const I18nContext = createContext<Translations>(translations.en);

export function I18nProvider({ children }: { children: ReactNode }) {
  const { data: settings } = useSettingsQuery();
  const t = translations[settings.language];

  return <I18nContext.Provider value={t}>{children}</I18nContext.Provider>;
}

export function useI18n(): Translations {
  return useContext(I18nContext);
}
