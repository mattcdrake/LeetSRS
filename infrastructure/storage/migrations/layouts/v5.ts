import { storage } from '#imports';

// Layout introduced by migration 5. Read the combined connection without
// consulting retained legacy keys, validating fields, or supplying defaults.
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
  const {
    githubPat: _legacyPat,
    gistId: _legacyId,
    gistSyncEnabled: _legacyEnabled,
    gistConnection,
    ...settings
  } = syncData;
  return {
    ...localData,
    settings,
    ...(Object.hasOwn(syncData, 'gistConnection') ? { gistConnection } : {}),
  };
}
