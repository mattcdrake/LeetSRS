import { describe, it, expect, afterEach, vi } from 'vitest';
import { detectBrowserLanguage } from '..';

function mockLanguages(languages: string[]) {
  vi.stubGlobal('navigator', { languages });
}

describe('detectBrowserLanguage', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('exact match', () => {
    mockLanguages(['pl']);
    expect(detectBrowserLanguage()).toBe('pl');
  });

  it('exact match with region code', () => {
    mockLanguages(['zh-CN']);
    expect(detectBrowserLanguage()).toBe('zh-CN');
  });

  it('base language match (en-US → en)', () => {
    mockLanguages(['en-US']);
    expect(detectBrowserLanguage()).toBe('en');
  });

  it('zh variant falls back to zh-CN', () => {
    mockLanguages(['zh-TW']);
    expect(detectBrowserLanguage()).toBe('zh-CN');
  });

  it('zh-Hans falls back to zh-CN', () => {
    mockLanguages(['zh-Hans']);
    expect(detectBrowserLanguage()).toBe('zh-CN');
  });

  it('picks first matching language from preferences', () => {
    mockLanguages(['fr', 'pl', 'en']);
    expect(detectBrowserLanguage()).toBe('pl');
  });

  it('falls back to en for unsupported languages', () => {
    mockLanguages(['fr', 'de', 'ja']);
    expect(detectBrowserLanguage()).toBe('en');
  });

  it('falls back to en when navigator.languages is empty', () => {
    mockLanguages([]);
    expect(detectBrowserLanguage()).toBe('en');
  });
});
