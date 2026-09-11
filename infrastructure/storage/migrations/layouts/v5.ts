import { storage } from '#imports';

// Layout v5 keeps the connection in local storage. Expose its raw value for the
// caller's historical validator; retained legacy sync keys are no longer inputs.
export async function readDataset(): Promise<Record<string, unknown>> {
  const [local, sync] = await Promise.all([storage.snapshot('local'), storage.snapshot('sync')]);
  const localData = Object.fromEntries(
    Object.entries(local)
      .filter(
        ([key]) => key.startsWith('leetsrs:') && key !== 'leetsrs:schemaVersion' && !key.startsWith('leetsrs:notes:')
      )
      .map(([key, value]) => [key.slice('leetsrs:'.length), value])
  );
  const settings = Object.fromEntries(
    Object.entries(sync)
      .filter(
        ([key]) =>
          key.startsWith('leetsrs:') &&
          !['leetsrs:githubPat', 'leetsrs:gistId', 'leetsrs:gistSyncEnabled'].includes(key)
      )
      .map(([key, value]) => [key.slice('leetsrs:'.length), value])
  );
  const { gistConnection, ...data } = localData;
  return { ...data, settings, gistSync: gistConnection ?? {} };
}
