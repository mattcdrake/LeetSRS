import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fakeBrowser } from 'wxt/testing/fake-browser';
import { storage } from 'wxt/utils/storage';
import { translations } from '@/i18n';
import { STORAGE_KEYS } from '@/infrastructure/storage/storage-keys';
import { createDeferred } from '@/test/utils/deferred';
import { getStoredTranslations, watchStoredTranslations } from '../translations';

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

  it('loads once, follows language changes and removal, and stops after unsubscribe', async () => {
    await storage.setItem(STORAGE_KEYS.language, 'en');
    vi.stubGlobal('navigator', { languages: ['de'] });
    const onChange = vi.fn();
    const onError = vi.fn();
    const getItem = vi.spyOn(storage, 'getItem');
    const stop = watchStoredTranslations(onChange, onError);
    try {
      await vi.waitFor(() => expect(onChange).toHaveBeenLastCalledWith(translations.en));
      await storage.setItem(STORAGE_KEYS.language, 'pl');
      await vi.waitFor(() => expect(onChange).toHaveBeenLastCalledWith(translations.pl));
      await storage.removeItem(STORAGE_KEYS.language);
      await vi.waitFor(() => expect(onChange).toHaveBeenLastCalledWith(translations.de));
      expect(getItem).toHaveBeenCalledOnce();
      expect(onError).not.toHaveBeenCalled();
    } finally {
      stop();
    }
    onChange.mockClear();
    await storage.setItem(STORAGE_KEYS.language, 'en');
    expect(onChange).not.toHaveBeenCalled();
  });

  it('does not overwrite a storage change with an older initial read', async () => {
    const initial = createDeferred<string>();
    vi.spyOn(storage, 'getItem').mockReturnValueOnce(initial.promise);
    const onChange = vi.fn();
    const stop = watchStoredTranslations(onChange, vi.fn());
    try {
      await storage.setItem(STORAGE_KEYS.language, 'pl');
      await vi.waitFor(() => expect(onChange).toHaveBeenCalledWith(translations.pl));
      initial.resolve('en');
      await initial.promise;
      expect(onChange).toHaveBeenCalledOnce();
    } finally {
      stop();
    }
  });

  it('ignores an initial read that finishes after unsubscribe', async () => {
    const initial = createDeferred<string>();
    vi.spyOn(storage, 'getItem').mockReturnValueOnce(initial.promise);
    const onChange = vi.fn();
    const stop = watchStoredTranslations(onChange, vi.fn());
    stop();
    initial.resolve('en');
    await initial.promise;
    expect(onChange).not.toHaveBeenCalled();
  });

  it('reports an initial read failure and still receives later changes', async () => {
    const error = new Error('storage unavailable');
    vi.spyOn(storage, 'getItem').mockRejectedValueOnce(error);
    const onChange = vi.fn();
    const onError = vi.fn();
    const stop = watchStoredTranslations(onChange, onError);
    try {
      await vi.waitFor(() => expect(onError).toHaveBeenCalledWith(error));
      await storage.setItem(STORAGE_KEYS.language, 'pl');
      await vi.waitFor(() => expect(onChange).toHaveBeenCalledWith(translations.pl));
    } finally {
      stop();
    }
  });
});
