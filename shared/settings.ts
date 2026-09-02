export const DEFAULT_MAX_NEW_CARDS_PER_DAY = 3;
export const MIN_NEW_CARDS_PER_DAY = 0;
export const MAX_NEW_CARDS_PER_DAY = 100;

export const DEFAULT_DAY_START_HOUR = 0;
export const MIN_DAY_START_HOUR = 0;
export const MAX_DAY_START_HOUR = 23;

export const DEFAULT_RESET_EDITOR_ON_EVERY_PROBLEM = false;
export const DEFAULT_RESET_EDITOR_ON_DUE_REVIEW = false;
export const DEFAULT_BADGE_ENABLED = true;
export const DEFAULT_ANIMATIONS_ENABLED = true;
export type Theme = 'light' | 'dark';
export const DEFAULT_THEME: Theme = 'dark';

// Language settings
export type Language = 'de' | 'en' | 'hi' | 'pl' | 'zh-CN';
export const DEFAULT_LANGUAGE: Language = 'en';

export interface Settings {
  maxNewCardsPerDay: number;
  dayStartHour: number;
  animationsEnabled: boolean;
  theme: Theme;
  resetEditorOnEveryProblem: boolean;
  resetEditorOnDueReview: boolean;
  badgeEnabled: boolean;
  language: Language;
}

// Stats rollup
export const DAILY_STATS_RETENTION_DAYS = 30;

// Feature flags
export const FEATURE_FLAGS = {
  languageSelection: true,
} as const;
