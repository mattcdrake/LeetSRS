export const STORAGE_KEYS = {
  learningDocument: 'local:leetsrs:learningDocument',
  // Legacy names retained only for startup conversion, cleanup, and reset.
  cards: 'local:leetsrs:cards',
  stats: 'local:leetsrs:stats',
  maxNewCardsPerDay: 'sync:leetsrs:maxNewCardsPerDay',
  theme: 'sync:leetsrs:theme',
  resetEditorOnEveryProblem: 'sync:leetsrs:resetEditorOnEveryProblem',
  resetEditorOnDueReview: 'sync:leetsrs:resetEditorOnDueReview',
  badgeEnabled: 'sync:leetsrs:badgeEnabled',
  language: 'sync:leetsrs:language',
  schemaVersion: 'local:leetsrs:schemaVersion',
  dataUpdatedAt: 'local:leetsrs:dataUpdatedAt',
  // GitHub Gist Sync
  gistConnection: 'sync:leetsrs:gistConnection',
  lastSyncTime: 'local:leetsrs:lastSyncTime',
  lastSyncDirection: 'local:leetsrs:lastSyncDirection',
} as const;
