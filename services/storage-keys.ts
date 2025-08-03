export const STORAGE_KEYS = {
  cards: 'leetreps:cards',
  slugToCardId: 'leetreps:slugToCardId',
} as const;

export type StorageKey = (typeof STORAGE_KEYS)[keyof typeof STORAGE_KEYS];
