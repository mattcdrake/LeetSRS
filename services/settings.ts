import type { Settings } from '@/domain/settings';
import { DEFAULT_SETTINGS, getSettingDefinition, SETTING_KEYS, validateSettings } from '@/domain/settings-policy';
import { detectBrowserLanguage } from '@/infrastructure/browser/language';
import { markDataUpdated } from '@/infrastructure/storage/data-tracker';
import { readSetting, removeSetting, writeSetting } from '@/infrastructure/storage/settings';

export async function getSettings(): Promise<Settings> {
  const entries = await Promise.all(
    SETTING_KEYS.map(async (key) => {
      const definition = getSettingDefinition(key);
      const value: unknown = await readSetting(key);
      return [
        key,
        definition.validate(value) ? value : key === 'language' ? detectBrowserLanguage() : DEFAULT_SETTINGS[key],
      ] as const;
    })
  );
  return Object.fromEntries(entries) as unknown as Settings;
}

export async function updateSettings(changes: Partial<Settings>): Promise<void> {
  validateSettings(changes);
  const changedKeys = SETTING_KEYS.filter((key) => Object.hasOwn(changes, key));

  if (changedKeys.length === 0) {
    return;
  }

  await Promise.all(changedKeys.map((key) => writeSetting(key, changes[key] as Settings[typeof key])));
  await markDataUpdated();
}

export async function exportSettings(): Promise<Partial<Settings>> {
  const entries = await Promise.all(
    SETTING_KEYS.map(async (key) => {
      const definition = getSettingDefinition(key);
      const value: unknown = await readSetting(key);
      return definition.validate(value) ? ([key, value] as const) : null;
    })
  );

  return Object.fromEntries(entries.filter((entry) => entry !== null)) as Partial<Settings>;
}

export async function resetSettings(): Promise<void> {
  await Promise.all(SETTING_KEYS.map((key) => removeSetting(key)));
}
