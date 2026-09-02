import type { Settings } from '@/shared/settings';

export function buildSettings(overrides: Partial<Settings> = {}): Settings {
  return {
    maxNewCardsPerDay: 3,
    dayStartHour: 0,
    animationsEnabled: true,
    theme: 'dark',
    resetEditorOnEveryProblem: false,
    resetEditorOnDueReview: false,
    badgeEnabled: true,
    language: 'en',
    ...overrides,
  };
}
