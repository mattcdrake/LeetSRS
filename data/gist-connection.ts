import { storage } from '#imports';
import { type GistSyncConfig, gistSyncConfigSchema } from '@/domain/gist-sync';
import { STORAGE_KEYS } from './storage-keys';

export async function readGistConnection(): Promise<GistSyncConfig> {
  return gistSyncConfigSchema.parse(
    (await storage.getItem<unknown>(STORAGE_KEYS.gistConnection)) ?? { pat: '', gistId: null, enabled: false }
  );
}

export function writeGistConnection(config: GistSyncConfig): Promise<void> {
  return storage.setItem(STORAGE_KEYS.gistConnection, gistSyncConfigSchema.parse(config));
}

export function removeGistConnection(): Promise<void> {
  // Retained legacy keys must also be cleared so reset reaches older browsers.
  return storage.removeItems([
    STORAGE_KEYS.gistConnection,
    'sync:leetsrs:githubPat',
    'sync:leetsrs:gistId',
    'sync:leetsrs:gistSyncEnabled',
  ]);
}
