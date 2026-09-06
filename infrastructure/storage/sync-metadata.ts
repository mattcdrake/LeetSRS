import { storage } from '#imports';
import { STORAGE_KEYS } from './storage-keys';

// Raw sync metadata shared by sync, backup/reset, and data tracking.
// Callers retain defaults, PAT preservation, timestamps, and operation order.
// These calls do not mark local edits.
interface SyncMetadata {
  githubPat: string;
  gistId: string;
  gistSyncEnabled: boolean;
  lastSyncTime: string;
  lastSyncDirection: 'push' | 'pull';
  dataUpdatedAt: string;
}

export function readSyncMetadata<K extends keyof SyncMetadata>(key: K): Promise<SyncMetadata[K] | null> {
  return storage.getItem<SyncMetadata[K]>(STORAGE_KEYS[key]);
}

export function writeSyncMetadata<K extends keyof SyncMetadata>(key: K, value: SyncMetadata[K]): Promise<void> {
  return storage.setItem(STORAGE_KEYS[key], value);
}

export function removeSyncMetadata(key: keyof SyncMetadata): Promise<void> {
  return storage.removeItem(STORAGE_KEYS[key]);
}
