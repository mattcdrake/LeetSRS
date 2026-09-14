import { describe, expect, it } from 'vitest';
import { getSupportedLanguage, selectLanguage } from '@/shared/settings';

describe('selectLanguage', () => {
  it('base language match (de-DE → de)', () => {
    expect(selectLanguage(['de-DE'])).toBe('de');
  });

  it('zh variant falls back to zh-CN', () => {
    expect(selectLanguage(['zh-TW'])).toBe('zh-CN');
  });

  it('picks first matching language from preferences', () => {
    expect(selectLanguage(['fr', 'pl', 'en'])).toBe('pl');
  });

  it('falls back to en for unsupported languages', () => {
    expect(selectLanguage(['fr', 'ja', 'ko'])).toBe('en');
  });
});

describe('getSupportedLanguage', () => {
  it.each(['toString', '__proto__'])('rejects prototype name %s', (language) => {
    expect(getSupportedLanguage(language)).toBeUndefined();
    expect(selectLanguage([language])).toBe('en');
    expect(selectLanguage([`${language}-US`, 'pl'])).toBe('pl');
  });
});
