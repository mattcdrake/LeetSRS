import { beforeEach, describe, expect, it } from 'vitest';
import { fakeBrowser } from 'wxt/testing/fake-browser';
import { storage } from 'wxt/utils/storage';
import { SETTING_KEYS, type Settings } from '@/domain/settings';
import { buildSettings } from '@/test/utils/settings-mocks';
import { readSetting } from '../settings';
import { STORAGE_KEYS } from '../storage-keys';

describe('stored settings decoding', () => {
  beforeEach(() => fakeBrowser.reset());

  it.each(SETTING_KEYS)('returns null for missing %s and preserves a valid value', async (key) => {
    expect(await readSetting(key)).toBeNull();
    const settings = buildSettings({ maxNewCardsPerDay: 0, dayStartHour: 0, badgeEnabled: false, language: 'zh-CN' });
    await storage.setItem(STORAGE_KEYS[key], settings[key]);
    expect(await readSetting(key)).toBe(settings[key]);
  });

  it.each<[keyof Settings, unknown]>([
    ['maxNewCardsPerDay', 101],
    ['dayStartHour', 1.5],
    ['theme', 'invalid'],
    ['resetEditorOnEveryProblem', 'true'],
    ['resetEditorOnDueReview', 0],
    ['badgeEnabled', {}],
    ['language', 'constructor'],
  ])('returns null for invalid %s without rewriting storage', async (key, value) => {
    await storage.setItem(STORAGE_KEYS[key], value);
    expect(await readSetting(key)).toBeNull();
    expect(await storage.getItem(STORAGE_KEYS[key])).toEqual(value);
  });
});
