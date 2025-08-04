export const STORAGE_KEYS = {
  cards: 'local:leetreps:cards',
  stats: 'local:leetreps:stats',
  notes: 'local:leetreps:notes',
} as const;

export type StorageKey = (typeof STORAGE_KEYS)[keyof typeof STORAGE_KEYS];

export function getNoteStorageKey(cardId: string): `local:leetreps:notes:${string}` {
  return `${STORAGE_KEYS.notes}:${cardId}`;
}
