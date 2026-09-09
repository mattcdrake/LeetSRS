import { describe, expect, it } from 'vitest';
import { getSupportedLanguage, selectLanguage } from '../language';

describe('selectLanguage', () => {
  it('exact match', () => {
    expect(selectLanguage(['pl'])).toBe('pl');
  });

  it('exact match with region code', () => {
    expect(selectLanguage(['zh-CN'])).toBe('zh-CN');
  });

  it('base language match (en-US → en)', () => {
    expect(selectLanguage(['en-US'])).toBe('en');
  });

  it('base language match (de-DE → de)', () => {
    expect(selectLanguage(['de-DE'])).toBe('de');
  });

  it('zh variant falls back to zh-CN', () => {
    expect(selectLanguage(['zh-TW'])).toBe('zh-CN');
  });

  it('zh-Hans falls back to zh-CN', () => {
    expect(selectLanguage(['zh-Hans'])).toBe('zh-CN');
  });

  it('picks first matching language from preferences', () => {
    expect(selectLanguage(['fr', 'pl', 'en'])).toBe('pl');
  });

  it('falls back to en for unsupported languages', () => {
    expect(selectLanguage(['fr', 'ja', 'ko'])).toBe('en');
  });

  it('falls back to en when navigator.languages is empty', () => {
    expect(selectLanguage([])).toBe('en');
  });
});

describe('getSupportedLanguage', () => {
  it.each(['de', 'en', 'hi', 'pl', 'zh-CN'])('accepts %s', (language) => {
    expect(getSupportedLanguage(language)).toBe(language);
  });

  it.each([null, undefined, 1, 'fr', 'EN', 'en-US'])('rejects unsupported stored value %s', (language) => {
    expect(getSupportedLanguage(language)).toBeUndefined();
  });

  it.each(['toString', 'constructor', '__proto__'])('rejects prototype name %s', (language) => {
    expect(getSupportedLanguage(language)).toBeUndefined();
    expect(selectLanguage([language])).toBe('en');
    expect(selectLanguage([`${language}-US`, 'pl'])).toBe('pl');
  });
});
