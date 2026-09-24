import { storage } from '#imports';

// Records the PAT-to-OAuth migration so it runs once and can offer the previous Gist.
export const patMigrationItem = storage.defineItem<unknown>('local:leetsrs:oauthMigration');

// Retired PAT storage shared by startup migration and reset cleanup.
export const LEGACY_PAT_KEYS = [
  'sync:leetsrs:gistConnection',
  'sync:leetsrs:githubPat',
  'sync:leetsrs:gistId',
  'sync:leetsrs:gistSyncEnabled',
] as const;
