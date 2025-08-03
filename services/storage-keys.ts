export const STORAGE_KEYS = {
  cards: 'local:leetreps:cards',
  stats: 'local:leetreps:stats',
} as const;

export type StorageKey = (typeof STORAGE_KEYS)[keyof typeof STORAGE_KEYS];
