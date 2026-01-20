export const STORAGE_KEYS = {
  cards: 'local:leetsrs:cards',
  stats: 'local:leetsrs:stats',
  notes: 'local:leetsrs:notes',
  maxNewCardsPerDay: 'sync:leetsrs:maxNewCardsPerDay',
  dayStartHour: 'sync:leetsrs:dayStartHour',
  animationsEnabled: 'sync:leetsrs:animationsEnabled',
  theme: 'sync:leetsrs:theme',
  autoClearLeetcode: 'sync:leetsrs:autoClearLeetcode',
  autoClearNeetcode: 'sync:leetsrs:autoClearNeetcode',
  schemaVersion: 'local:leetsrs:schemaVersion',
  // Tracks when actual data was last modified (for sync)
  dataUpdatedAt: 'local:leetsrs:dataUpdatedAt',
  // GitHub Gist Sync
  githubPat: 'sync:leetsrs:githubPat',
  gistId: 'sync:leetsrs:gistId',
  gistSyncEnabled: 'sync:leetsrs:gistSyncEnabled',
  lastSyncTime: 'local:leetsrs:lastSyncTime',
  lastSyncDirection: 'local:leetsrs:lastSyncDirection',
} as const;

export type StorageKey = (typeof STORAGE_KEYS)[keyof typeof STORAGE_KEYS];

export function getNoteStorageKey(cardId: string): `local:leetsrs:notes:${string}` {
  return `${STORAGE_KEYS.notes}:${cardId}`;
}
