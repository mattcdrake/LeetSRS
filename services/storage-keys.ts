export const STORAGE_KEYS = {
  cards: 'local:leetreps:cards',
  slugToCardId: 'local:leetreps:slugToCardId',
} as const;

export type StorageKey = (typeof STORAGE_KEYS)[keyof typeof STORAGE_KEYS];
