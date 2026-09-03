export type Theme = 'system' | 'light' | 'dark';
export type Language = 'de' | 'en' | 'hi' | 'pl' | 'zh-CN';

export const SETTINGS_CONSTRAINTS = {
  maxNewCardsPerDay: { min: 0, max: 100 },
  dayStartHour: { min: 0, max: 23 },
} as const;

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
