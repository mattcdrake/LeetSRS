import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fakeBrowser } from 'wxt/testing/fake-browser';
import { storage } from 'wxt/utils/storage';
import { translations } from '@/i18n';
import { STORAGE_KEYS } from '@/infrastructure/storage/storage-keys';
import { createDeferred } from '@/test/utils/deferred';
import { getStoredTranslations } from '../translations';

describe('stored translations', () => {
  beforeEach(() => {
    fakeBrowser.reset();
    fakeBrowser.runtime.id = 'test';
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
    fakeBrowser.reset();
  });

  describe('getStoredTranslations', () => {
    it('should return translations object', async () => {
      const t = await getStoredTranslations();
      expect(t).toBeDefined();
      expect(t.app.name).toBe('LeetSRS');
    });

    it('should have all required translation keys', async () => {
      const t = await getStoredTranslations();
      expect(t.settings.gistSync.gistDescription).toBeDefined();
      expect(typeof t.settings.gistSync.gistDescription).toBe('string');
    });
  });

  describe('stored language', () => {
    it('should use the current stored language', async () => {
      await storage.setItem(STORAGE_KEYS.language, 'en');
      const t = await getStoredTranslations();
      expect(t).toBe(translations.en);
    });

    it('should fall back to default language for invalid storage values', async () => {
      // Simulate corrupted/invalid language in storage
      await storage.setItem(STORAGE_KEYS.language, 'xx-INVALID');
      expect(await getStoredTranslations()).toBe(translations.en);
    });
  });

  it('reads only language and detects fallback after the storage read resolves', async () => {
    const languageRead = createDeferred<null>();
    const getItem = vi.spyOn(storage, 'getItem').mockReturnValueOnce(languageRead.promise);
    const languages = vi.fn(() => ['pl']);
    vi.stubGlobal('navigator', {
      get languages() {
        return languages();
      },
    });

    const pending = getStoredTranslations();
    expect(getItem.mock.calls).toEqual([[STORAGE_KEYS.language]]);
    expect(languages).not.toHaveBeenCalled();
    languageRead.resolve(null);
    expect(await pending).toBe(translations.pl);
    expect(languages).toHaveBeenCalledOnce();
  });

  it('uses stored language without accessing browser preferences', async () => {
    await storage.setItem(STORAGE_KEYS.language, 'de');
    const languages = vi.fn(() => ['pl']);
    vi.stubGlobal('navigator', {
      get languages() {
        return languages();
      },
    });

    expect(await getStoredTranslations()).toBe(translations.de);
    expect(languages).not.toHaveBeenCalled();
  });

  it('propagates storage failure without detecting a fallback', async () => {
    const failure = new Error('language read failed');
    vi.spyOn(storage, 'getItem').mockRejectedValueOnce(failure);
    const languages = vi.fn(() => ['pl']);
    vi.stubGlobal('navigator', {
      get languages() {
        return languages();
      },
    });

    await expect(getStoredTranslations()).rejects.toBe(failure);
    expect(languages).not.toHaveBeenCalled();
  });
});
