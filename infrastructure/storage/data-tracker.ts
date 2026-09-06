import { writeSyncMetadata } from './sync-metadata';

export async function markDataUpdated(): Promise<void> {
  await writeSyncMetadata('dataUpdatedAt', new Date().toISOString());
}
