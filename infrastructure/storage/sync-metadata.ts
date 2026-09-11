import { z } from 'zod';
import { storage } from '#imports';
import { gistSyncConfigSchema } from '@/domain/gist-sync';
import { STORAGE_KEYS } from './storage-keys';

// Sync metadata shared by sync, backup/reset, and data tracking.
// Callers retain defaults, PAT preservation, timestamps, and operation order.
// These calls do not mark local edits.
const syncMetadataSchema = z.object({
  gistConnection: gistSyncConfigSchema,
  lastSyncTime: z.string(),
  lastSyncDirection: z.enum(['push', 'pull']),
  dataUpdatedAt: z.string(),
});
type SyncMetadata = z.infer<typeof syncMetadataSchema>;

const fields: { [K in keyof SyncMetadata]: z.ZodType<SyncMetadata[K]> } = syncMetadataSchema.shape;

export async function readSyncMetadata<K extends keyof SyncMetadata>(key: K): Promise<SyncMetadata[K] | null> {
  const value = await storage.getItem<unknown>(STORAGE_KEYS[key]);
  return value == null ? null : fields[key].parse(value);
}

export function writeSyncMetadata<K extends keyof SyncMetadata>(key: K, value: SyncMetadata[K]): Promise<void> {
  return storage.setItem(STORAGE_KEYS[key], fields[key].parse(value));
}

export function removeSyncMetadata(key: keyof SyncMetadata): Promise<void> {
  return storage.removeItem(STORAGE_KEYS[key]);
}
