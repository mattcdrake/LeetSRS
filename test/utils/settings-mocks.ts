import type { Settings } from '@/shared/settings';

export function buildSettings(overrides: Partial<Settings> = {}): Settings {
  return {
    maxNewCardsPerDay: 3,
    theme: 'system',
    openRatingAfterSolving: true,
    resetEditorOnReviewQueue: false,
    language: 'en',
    preferredLeetcodeSite: 'leetcode.com',
    ...overrides,
  };
}
