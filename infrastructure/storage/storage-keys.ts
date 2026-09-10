export const STORAGE_KEYS = {
  cards: 'local:leetsrs:cards',
  stats: 'local:leetsrs:stats',
  maxNewCardsPerDay: 'sync:leetsrs:maxNewCardsPerDay',
  theme: 'sync:leetsrs:theme',
  resetEditorOnEveryProblem: 'sync:leetsrs:autoClearLeetcode',
  resetEditorOnDueReview: 'sync:leetsrs:resetEditorOnDueReview',
  badgeEnabled: 'sync:leetsrs:badgeEnabled',
  language: 'sync:leetsrs:language',
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
