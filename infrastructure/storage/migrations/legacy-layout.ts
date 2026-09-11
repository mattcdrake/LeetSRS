import { storage } from '#imports';

// Versions 1–3 share this physical layout. Read raw values without current-model
// validation or defaults so historical and malformed records reach their migration.
export async function readLegacyData(): Promise<Record<string, unknown>> {
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
