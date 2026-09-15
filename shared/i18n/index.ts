import type { Language } from '@/shared/settings';
import en from './en';
import zhCN from './zh-CN';

export type Translations = typeof en;

export const translations: Record<Language, Translations> = {
  en,
  'zh-CN': zhCN,
};
