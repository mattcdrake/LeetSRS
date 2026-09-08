import type { RatingKey } from '@/domain/ratings';

export const RATING_COLORS = {
  light: {
    again: '#c73e3e',
    hard: '#d97706',
    good: '#4271c4',
    easy: '#3d9156',
  },
  dark: {
    again: '#d14358',
    hard: '#e88c3a',
    good: '#5b8fd9',
    easy: '#52b169',
  },
} as const satisfies Record<'light' | 'dark', Record<RatingKey, string>>;
