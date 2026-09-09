import { storage } from '#imports';
import { type Settings, settingsSchema } from '@/domain/settings';
import { STORAGE_KEYS } from './storage-keys';

export async function readSetting(key: keyof Settings): Promise<Settings[keyof Settings] | null> {
  const value = await storage.getItem<unknown>(STORAGE_KEYS[key]);
  const result = settingsSchema.shape[key].safeParse(value);
  return result.success ? result.data : null;
}

export function writeSetting<K extends keyof Settings>(key: K, value: Settings[K]): Promise<void> {
  return storage.setItem(STORAGE_KEYS[key], value);
}

export function removeSetting(key: keyof Settings): Promise<void> {
  return storage.removeItem(STORAGE_KEYS[key]);
}
