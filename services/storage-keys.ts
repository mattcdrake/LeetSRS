export const STORAGE_KEYS = {
  cards: 'local:leetreps:cards',
} as const;

export type StorageKey = (typeof STORAGE_KEYS)[keyof typeof STORAGE_KEYS];
