import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fakeBrowser } from 'wxt/testing/fake-browser';
import { getSettings } from '@/services/settings';

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
    expect((await getSettings()).language).toBe('pl');
  });

  it('exact match with region code', async () => {
    mockLanguages(['zh-CN']);
    expect((await getSettings()).language).toBe('zh-CN');
  });

  it('base language match (en-US → en)', async () => {
    mockLanguages(['en-US']);
    expect((await getSettings()).language).toBe('en');
  });

  it('base language match (de-DE → de)', async () => {
    mockLanguages(['de-DE']);
    expect((await getSettings()).language).toBe('de');
  });

  it('zh variant falls back to zh-CN', async () => {
    mockLanguages(['zh-TW']);
    expect((await getSettings()).language).toBe('zh-CN');
  });

  it('zh-Hans falls back to zh-CN', async () => {
    mockLanguages(['zh-Hans']);
    expect((await getSettings()).language).toBe('zh-CN');
  });

  it('picks first matching language from preferences', async () => {
    mockLanguages(['fr', 'pl', 'en']);
    expect((await getSettings()).language).toBe('pl');
  });

  it('falls back to en for unsupported languages', async () => {
    mockLanguages(['fr', 'ja', 'ko']);
    expect((await getSettings()).language).toBe('en');
  });

  it('falls back to en when navigator.languages is empty', async () => {
    mockLanguages([]);
    expect((await getSettings()).language).toBe('en');
  });
});
