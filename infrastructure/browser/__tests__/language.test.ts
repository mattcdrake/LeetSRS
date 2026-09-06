import { afterEach, describe, expect, it, vi } from 'vitest';
import { detectBrowserLanguage } from '../language';

afterEach(() => vi.unstubAllGlobals());

describe('detectBrowserLanguage', () => {
  it('reads current browser preferences on each call', () => {
    vi.stubGlobal('navigator', { languages: ['de-DE'] });
    expect(detectBrowserLanguage()).toBe('de');
    vi.stubGlobal('navigator', { languages: ['zh-TW'] });
    expect(detectBrowserLanguage()).toBe('zh-CN');
  });

  it('falls back to English without navigator', () => {
    vi.stubGlobal('navigator', undefined);
    expect(detectBrowserLanguage()).toBe('en');
  });
});
