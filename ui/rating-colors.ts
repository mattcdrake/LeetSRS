import { Rating } from 'ts-fsrs';
import type { Translations } from '@/i18n';

export const RATING_COLORS = {
  light: {
    [Rating.Again]: '#c73e3e',
    [Rating.Hard]: '#d97706',
    [Rating.Good]: '#4271c4',
    [Rating.Easy]: '#3d9156',
  },
  dark: {
    [Rating.Again]: '#d14358',
    [Rating.Hard]: '#e88c3a',
    [Rating.Good]: '#5b8fd9',
    [Rating.Easy]: '#52b169',
  },
} as const satisfies Record<'light' | 'dark', Record<keyof Translations['ratings'], string>>;
