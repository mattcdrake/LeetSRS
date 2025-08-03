export const STORAGE_KEYS = {
  cards: 'leetreps_cards',
} as const;

export type StorageKey = (typeof STORAGE_KEYS)[keyof typeof STORAGE_KEYS];
