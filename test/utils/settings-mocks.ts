import type { Settings } from '@/domain/settings';

export function buildSettings(overrides: Partial<Settings> = {}): Settings {
  return {
    maxNewCardsPerDay: 3,
    theme: 'system',
    resetEditorOnReviewQueue: false,
    badgeEnabled: true,
    language: 'en',
    ...overrides,
  };
}
