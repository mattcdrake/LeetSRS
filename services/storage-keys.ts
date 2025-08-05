export const STORAGE_KEYS = {
  cards: 'local:leetsrs:cards',
  stats: 'local:leetsrs:stats',
  notes: 'local:leetsrs:notes',
} as const;

export type StorageKey = (typeof STORAGE_KEYS)[keyof typeof STORAGE_KEYS];

export function getNoteStorageKey(cardId: string): `local:leetsrs:notes:${string}` {
  return `${STORAGE_KEYS.notes}:${cardId}`;
}
