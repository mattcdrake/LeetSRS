import { storage } from '#imports';
import type { Settings } from '@/domain/settings';
import { STORAGE_KEYS } from './storage-keys';

export function readSetting(key: keyof Settings): Promise<unknown> {
  return storage.getItem(STORAGE_KEYS[key]);
}

export function writeSetting<K extends keyof Settings>(key: K, value: Settings[K]): Promise<void> {
  return storage.setItem(STORAGE_KEYS[key], value);
}

export function removeSetting(key: keyof Settings): Promise<void> {
  return storage.removeItem(STORAGE_KEYS[key]);
}
