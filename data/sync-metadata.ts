import { z } from 'zod';
import { storage } from '#imports';
import { STORAGE_KEYS } from './storage-keys';

// Sync status is separate from the learning document and its edit timestamp.
const syncMetadataSchema = z.object({
  lastSyncTime: z.string(),
  lastSyncDirection: z.enum(['push', 'pull']),
});
type SyncMetadata = z.infer<typeof syncMetadataSchema>;

const syncStatusUpdateSchema = syncMetadataSchema.partial({ lastSyncDirection: true });

const fields: { [K in keyof SyncMetadata]: z.ZodType<SyncMetadata[K]> } = syncMetadataSchema.shape;

export async function readSyncMetadata<K extends keyof SyncMetadata>(key: K): Promise<SyncMetadata[K] | null> {
  const value = await storage.getItem<unknown>(STORAGE_KEYS[key]);
  return value == null ? null : fields[key].parse(value);
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

export function removeSyncStatus(): Promise<void> {
  return storage.removeItems([STORAGE_KEYS.lastSyncTime, STORAGE_KEYS.lastSyncDirection]);
}
