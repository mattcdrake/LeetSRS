import { storage } from '#imports';

// Layout v4, introduced by migration 4. Unlike v0, this reader omits the separate
// notes collection assembled from leetsrs:notes:* keys; notes now live in cards.
// Return stored values unchanged so callers can validate the relevant schema
// version without applying domain/cards.ts or other application schemas first.
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
