import { z } from 'zod';
import { storage } from '#imports';
import { STORAGE_KEYS } from './storage-keys';

// Sync status is separate from the learning document and its edit timestamp.
const syncMetadataSchema = z.object({
  lastSyncTime: z.string(),
  lastSyncDirection: z.enum(['push', 'pull']),
});

const syncStatusUpdateSchema = syncMetadataSchema.partial({ lastSyncDirection: true });
const storedSyncStatusSchema = z.object({
  lastSyncTime: syncMetadataSchema.shape.lastSyncTime.nullable(),
  lastSyncDirection: syncMetadataSchema.shape.lastSyncDirection.nullable(),
});

export async function readSyncStatus(): Promise<z.infer<typeof storedSyncStatusSchema>> {
  const [{ value: lastSyncTime = null }, { value: lastSyncDirection = null }] = await storage.getItems([
    STORAGE_KEYS.lastSyncTime,
    STORAGE_KEYS.lastSyncDirection,
  ]);

  return storedSyncStatusSchema.parse({ lastSyncTime, lastSyncDirection });
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
