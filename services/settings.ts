import {
  DEFAULT_SETTINGS,
  SETTING_KEYS,
  type Settings,
  type SettingsUpdate,
  settingsSchema,
  settingsUpdateSchema,
} from '@/domain/settings';
import { detectBrowserLanguage } from '@/infrastructure/browser/language';
import { markDataUpdated } from '@/infrastructure/storage/data-tracker';
import { readSetting, removeSetting, writeSetting } from '@/infrastructure/storage/settings';

export async function getSettings(): Promise<Settings> {
  const entries = await Promise.all(
    SETTING_KEYS.map(async (key) => {
      const value: unknown = await readSetting(key);
      const result = settingsSchema.shape[key].safeParse(value);
      return [
        key,
        result.success ? result.data : key === 'language' ? detectBrowserLanguage() : DEFAULT_SETTINGS[key],
      ] as const;
    })
  );
  return settingsSchema.parse(Object.fromEntries(entries));
}

export async function updateSettings(changes: SettingsUpdate): Promise<void> {
  const parsedChanges = settingsUpdateSchema.parse(changes);
  const changedKeys = SETTING_KEYS.filter((key) => Object.hasOwn(parsedChanges, key));

  if (changedKeys.length === 0) {
    return;
  }

  await Promise.all(changedKeys.map((key) => writeSetting(key, parsedChanges[key] as Settings[typeof key])));
  await markDataUpdated();
}

export async function exportSettings(): Promise<Partial<Settings>> {
  const entries = await Promise.all(
    SETTING_KEYS.map(async (key) => {
      const value: unknown = await readSetting(key);
      const result = settingsSchema.shape[key].safeParse(value);
      return result.success ? ([key, result.data] as const) : null;
    })
  );

  return Object.fromEntries(entries.filter((entry) => entry !== null)) as Partial<Settings>;
}

export async function resetSettings(): Promise<void> {
  await Promise.all(SETTING_KEYS.map((key) => removeSetting(key)));
}
