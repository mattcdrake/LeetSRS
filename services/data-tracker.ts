import { storage } from '#imports';
import { STORAGE_KEYS } from './storage-keys';

export async function markDataUpdated(): Promise<void> {
  await storage.setItem(STORAGE_KEYS.dataUpdatedAt, new Date().toISOString());
}
