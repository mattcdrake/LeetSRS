import { describe, expect, it } from 'vitest';
import type { Settings } from '../settings';
import { validateSettings } from '../settings-policy';

describe('settings validation', () => {
  it('reports the first invalid setting in policy order regardless of input order', () => {
    expect(() => validateSettings({ dayStartHour: -1, maxNewCardsPerDay: -1 })).toThrow(
      'Max new cards per day must be between 0 and 100'
    );
  });

  it('validates explicit undefined but ignores inherited and unknown settings', () => {
    expect(() => validateSettings({ theme: undefined })).toThrow('Theme must be "system", "light", or "dark"');
    const changes = Object.create({ theme: 'invalid' }) as Partial<Settings>;
    Object.assign(changes, { unknown: 'ignored' });
    expect(() => validateSettings(changes)).not.toThrow();
  });

  it.each([
    { maxNewCardsPerDay: 0, dayStartHour: 0 },
    { maxNewCardsPerDay: 100, dayStartHour: 23 },
  ])('accepts inclusive numeric boundaries %j', (changes) => {
    expect(() => validateSettings(changes)).not.toThrow();
  });

  it('preserves language validation and the full English error', () => {
    expect(() => validateSettings({ language: 'toString' as Settings['language'] })).not.toThrow();
    expect(() => validateSettings({ language: 'EN' as Settings['language'] })).toThrow(
      'Unsupported language: EN. Supported languages: de, en, hi, pl, zh-CN'
    );
  });
});
