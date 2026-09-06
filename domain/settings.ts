import type { Language } from './language';

export type Theme = 'system' | 'light' | 'dark';

export const SETTINGS_CONSTRAINTS = {
  maxNewCardsPerDay: { min: 0, max: 100 },
  dayStartHour: { min: 0, max: 23 },
} as const;

export interface Settings {
  maxNewCardsPerDay: number;
  dayStartHour: number;
  theme: Theme;
  resetEditorOnEveryProblem: boolean;
  resetEditorOnDueReview: boolean;
  badgeEnabled: boolean;
  language: Language;
}
