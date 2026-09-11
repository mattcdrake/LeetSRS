export const STORAGE_KEYS = {
  cards: 'local:leetsrs:cards',
  stats: 'local:leetsrs:stats',
  maxNewCardsPerDay: 'sync:leetsrs:maxNewCardsPerDay',
  theme: 'sync:leetsrs:theme',
  resetEditorOnEveryProblem: 'sync:leetsrs:resetEditorOnEveryProblem',
  resetEditorOnDueReview: 'sync:leetsrs:resetEditorOnDueReview',
  badgeEnabled: 'sync:leetsrs:badgeEnabled',
  language: 'sync:leetsrs:language',
  schemaVersion: 'local:leetsrs:schemaVersion',
  // Tracks when actual data was last modified (for sync)
  dataUpdatedAt: 'local:leetsrs:dataUpdatedAt',
  // GitHub Gist Sync
  gistConnection: 'local:leetsrs:gistConnection',
  lastSyncTime: 'local:leetsrs:lastSyncTime',
  lastSyncDirection: 'local:leetsrs:lastSyncDirection',
} as const;

export type StorageKey = (typeof STORAGE_KEYS)[keyof typeof STORAGE_KEYS];
