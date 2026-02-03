export const DEFAULT_MAX_NEW_CARDS_PER_DAY = 3;
export const MIN_NEW_CARDS_PER_DAY = 0;
export const MAX_NEW_CARDS_PER_DAY = 100;

export const DEFAULT_DAY_START_HOUR = 0;
export const MIN_DAY_START_HOUR = 0;
export const MAX_DAY_START_HOUR = 23;

export const DEFAULT_AUTO_CLEAR_LEETCODE = false;
export const DEFAULT_BADGE_ENABLED = true;
export type Theme = 'light' | 'dark';
export const DEFAULT_THEME: Theme = 'dark';

// Language settings
export type Language = 'en';
export const DEFAULT_LANGUAGE: Language = 'en';
export const SUPPORTED_LANGUAGES: Language[] = ['en'];

// Feature flags
export const FEATURE_FLAGS = {
  languageSelection: false,
} as const;
