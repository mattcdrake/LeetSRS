import { storage } from '#imports';

// Layout introduced at schema version 4: note text is embedded in each card.
// Read raw values without current-model validation or defaults so historical
// and malformed records reach their migration.
export async function readDataset(): Promise<Record<string, unknown>> {
  const [local, sync] = await Promise.all([storage.snapshot('local'), storage.snapshot('sync')]);
  const localData = Object.fromEntries(
    Object.entries(local)
      .filter(
        ([key]) => key.startsWith('leetsrs:') && key !== 'leetsrs:schemaVersion' && !key.startsWith('leetsrs:notes:')
      )
      .map(([key, value]) => [key.slice('leetsrs:'.length), value])
  );
  const syncData = Object.fromEntries(
    Object.entries(sync)
      .filter(([key]) => key.startsWith('leetsrs:'))
      .map(([key, value]) => [key.slice('leetsrs:'.length), value])
  );
  const { gistId, gistSyncEnabled, ...settings } = syncData;
  return {
    ...localData,
    settings,
    gistSync: {
      ...(Object.hasOwn(syncData, 'gistId') ? { gistId } : {}),
      ...(Object.hasOwn(syncData, 'gistSyncEnabled') ? { enabled: gistSyncEnabled } : {}),
    },
  };
}
