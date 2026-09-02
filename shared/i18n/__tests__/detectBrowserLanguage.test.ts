import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fakeBrowser } from 'wxt/testing/fake-browser';
import { getLanguage } from '@/services/settings';

function mockLanguages(languages: string[]) {
  vi.stubGlobal('navigator', { languages });
}

describe('detectBrowserLanguage', () => {
  beforeEach(() => {
    fakeBrowser.reset();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('exact match', async () => {
    mockLanguages(['pl']);
    expect(await getLanguage()).toBe('pl');
  });

  it('exact match with region code', async () => {
    mockLanguages(['zh-CN']);
    expect(await getLanguage()).toBe('zh-CN');
  });

  it('base language match (en-US → en)', async () => {
    mockLanguages(['en-US']);
    expect(await getLanguage()).toBe('en');
  });

  it('base language match (de-DE → de)', async () => {
    mockLanguages(['de-DE']);
    expect(await getLanguage()).toBe('de');
  });

  it('zh variant falls back to zh-CN', async () => {
    mockLanguages(['zh-TW']);
    expect(await getLanguage()).toBe('zh-CN');
  });

  it('zh-Hans falls back to zh-CN', async () => {
    mockLanguages(['zh-Hans']);
    expect(await getLanguage()).toBe('zh-CN');
  });

  it('picks first matching language from preferences', async () => {
    mockLanguages(['fr', 'pl', 'en']);
    expect(await getLanguage()).toBe('pl');
  });

  it('falls back to en for unsupported languages', async () => {
    mockLanguages(['fr', 'ja', 'ko']);
    expect(await getLanguage()).toBe('en');
  });

  it('falls back to en when navigator.languages is empty', async () => {
    mockLanguages([]);
    expect(await getLanguage()).toBe('en');
  });
});
