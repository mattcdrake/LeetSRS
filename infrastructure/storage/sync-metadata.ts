import { z } from 'zod';
import { storage } from '#imports';
import { STORAGE_KEYS } from './storage-keys';

// Sync metadata shared by sync, backup/reset, and data tracking.
// Callers retain timestamps and operation order.
// These calls do not mark local edits.
const syncMetadataSchema = z.object({
  lastSyncTime: z.string(),
  lastSyncDirection: z.enum(['push', 'pull']),
  dataUpdatedAt: z.string(),
});
type SyncMetadata = z.infer<typeof syncMetadataSchema>;

const syncStatusUpdateSchema = syncMetadataSchema.omit({ dataUpdatedAt: true }).partial({ lastSyncDirection: true });

const fields: { [K in keyof SyncMetadata]: z.ZodType<SyncMetadata[K]> } = syncMetadataSchema.shape;

export async function readSyncMetadata<K extends keyof SyncMetadata>(key: K): Promise<SyncMetadata[K] | null> {
  const value = await storage.getItem<unknown>(STORAGE_KEYS[key]);
  return value == null ? null : fields[key].parse(value);
}

export function writeSyncMetadata<K extends keyof SyncMetadata>(key: K, value: SyncMetadata[K]): Promise<void> {
  return storage.setItem(STORAGE_KEYS[key], value);
}

export async function writeSyncStatus(status: z.infer<typeof syncStatusUpdateSchema>): Promise<void> {
  const prepared = syncStatusUpdateSchema.parse(status);
  const items: { key: typeof STORAGE_KEYS.lastSyncTime | typeof STORAGE_KEYS.lastSyncDirection; value: string }[] = [
    { key: STORAGE_KEYS.lastSyncTime, value: prepared.lastSyncTime },
  ];
  if (prepared.lastSyncDirection !== undefined) {
    items.push({ key: STORAGE_KEYS.lastSyncDirection, value: prepared.lastSyncDirection });
  }

  await storage.setItems(items);
}

export function removeSyncMetadata(key: keyof SyncMetadata): Promise<void> {
  return storage.removeItem(STORAGE_KEYS[key]);
}

export function removeSyncStatus(): Promise<void> {
  return storage.removeItems([STORAGE_KEYS.lastSyncTime, STORAGE_KEYS.lastSyncDirection]);
}
