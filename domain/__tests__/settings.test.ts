import { describe, expect, it } from 'vitest';
import { buildSettings } from '@/test/utils/settings-mocks';
import { SETTING_KEYS, settingsSchema, settingsUpdateSchema } from '../settings';

describe('settings validation', () => {
  it('parses all settings and strips unknown fields', () => {
    const settings = buildSettings();
    expect(settingsSchema.parse({ ...settings, unknown: 'ignored' })).toEqual(settings);
    expect(settingsUpdateSchema.parse({ ...settings, unknown: 'ignored' })).toEqual(settings);
  });

  it.each(SETTING_KEYS)('requires %s in full settings but treats undefined as omitted in updates', (key) => {
    const settings = { ...buildSettings(), [key]: undefined };
    expect(settingsSchema.safeParse(settings).success).toBe(false);
    expect(settingsUpdateSchema.parse({ [key]: undefined })).toEqual({});
  });

  it('ignores inherited and unknown settings while retaining own settings', () => {
    const changes = Object.create({ theme: 'invalid', badgeEnabled: false });
    Object.defineProperty(changes, 'theme', { value: 'dark' });
    Object.assign(changes, { maxNewCardsPerDay: 8, unknown: 'ignored' });
    expect(settingsUpdateSchema.parse(changes)).toEqual({ maxNewCardsPerDay: 8, theme: 'dark' });
  });

  it.each([{ maxNewCardsPerDay: 0 }, { maxNewCardsPerDay: 100 }])(
    'accepts inclusive numeric boundaries %j',
    (changes) => {
      expect(settingsUpdateSchema.parse(changes)).toEqual(changes);
    }
  );

  it.each(['EN', 'toString', 'constructor', '__proto__'])(
    'rejects unsupported language %s with the full error',
    (language) => {
      expect(() => settingsUpdateSchema.parse({ language })).toThrow(
        `Unsupported language: ${language}. Supported languages: de, en, hi, pl, zh-CN`
      );
    }
  );

  it.each([null, [], 'settings'])('rejects non-object updates: %j', (changes) => {
    expect(settingsUpdateSchema.safeParse(changes).success).toBe(false);
  });
});
