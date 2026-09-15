import type { Settings } from '@/shared/settings';

export function buildSettings(overrides: Partial<Settings> = {}): Settings {
  return {
    maxNewCardsPerDay: 3,
    theme: 'system',
    resetEditorOnReviewQueue: false,
    language: 'en',
    ...overrides,
  };
}
