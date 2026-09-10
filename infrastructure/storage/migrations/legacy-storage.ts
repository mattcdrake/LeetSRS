import { storage } from '#imports';

// The physical layout used by versions 0–3. Keep these names independent of current models/adapters.
const settingNames = [
  'maxNewCardsPerDay',
  'theme',
  'autoClearLeetcode',
  'resetEditorOnDueReview',
  'badgeEnabled',
  'language',
  'dayStartHour',
] as const;

export async function loadLegacyData(): Promise<unknown> {
  const [local, sync] = await Promise.all([storage.snapshot('local'), storage.snapshot('sync')]);
  return {
    ...Object.fromEntries(
      ['cards', 'stats', 'monthlyStats'].flatMap((name) =>
        Object.hasOwn(local, `leetsrs:${name}`) ? [[name, local[`leetsrs:${name}`]]] : []
      )
    ),
    notes: Object.fromEntries(
      Object.entries(local)
        .filter(([key]) => key.startsWith('leetsrs:notes:'))
        .map(([key, value]) => [key.slice('leetsrs:notes:'.length), value])
    ),
    settings: Object.fromEntries(
      settingNames.flatMap((name) => (Object.hasOwn(sync, `leetsrs:${name}`) ? [[name, sync[`leetsrs:${name}`]]] : []))
    ),
    gistSync: Object.fromEntries(
      [
        ['gistId', 'gistId'],
        ['enabled', 'gistSyncEnabled'],
      ].flatMap(([name, key]) => (Object.hasOwn(sync, `leetsrs:${key}`) ? [[name, sync[`leetsrs:${key}`]]] : []))
    ),
  };
}
