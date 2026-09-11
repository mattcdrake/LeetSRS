import { storage } from '#imports';
import { STORAGE_KEYS } from './storage-keys';

// Versions 1–3 share this physical layout. Read raw values without current-model
// validation or defaults so historical and malformed records reach their migration.
export async function readMigrationData(): Promise<Record<string, unknown>> {
  const [local, sync] = await Promise.all([storage.snapshot('local'), storage.snapshot('sync')]);
  const localData = Object.fromEntries(
    Object.entries(local)
      .filter(
        ([key]) => key.startsWith('leetsrs:') && key !== 'leetsrs:schemaVersion' && !key.startsWith('leetsrs:notes:')
      )
      .map(([key, value]) => [key.slice('leetsrs:'.length), value])
  );
  const notes = Object.fromEntries(
    Object.entries(local)
      .filter(([key]) => key.startsWith('leetsrs:notes:'))
      .map(([key, value]) => [key.slice('leetsrs:notes:'.length), value])
  );
  const syncData = Object.fromEntries(
    Object.entries(sync)
      .filter(([key]) => key.startsWith('leetsrs:'))
      .map(([key, value]) => [key.slice('leetsrs:'.length), value])
  );
  const { gistId, gistSyncEnabled, ...settings } = syncData;
  return {
    ...localData,
    notes,
    settings,
    gistSync: {
      ...(Object.hasOwn(syncData, 'gistId') ? { gistId } : {}),
      ...(Object.hasOwn(syncData, 'gistSyncEnabled') ? { enabled: gistSyncEnabled } : {}),
    },
  };
}

export async function writeMigrationData(before: Record<string, unknown>, after: unknown): Promise<void> {
  if (typeof after !== 'object' || after === null || Array.isArray(after)) {
    throw new Error('Expected an object dataset for the version 1–3 storage layout');
  }
  // These are the only physical changes in versions 1–3. Unaffected keys stay put.
  const cards = 'cards' in after ? after.cards : undefined;
  const removeDayStart =
    typeof before.settings === 'object' &&
    before.settings !== null &&
    Object.hasOwn(before.settings, 'dayStartHour') &&
    'settings' in after &&
    typeof after.settings === 'object' &&
    after.settings !== null &&
    !Object.hasOwn(after.settings, 'dayStartHour');

  if (cards !== undefined) await storage.setItem(STORAGE_KEYS.cards, cards);
  if (removeDayStart) await storage.removeItems(['sync:leetsrs:dayStartHour']);
}
