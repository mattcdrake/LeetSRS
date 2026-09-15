// Retired PAT storage shared by startup migration and reset cleanup.
export const LEGACY_PAT_KEYS = [
  'sync:leetsrs:gistConnection',
  'sync:leetsrs:githubPat',
  'sync:leetsrs:gistId',
  'sync:leetsrs:gistSyncEnabled',
] as const;
