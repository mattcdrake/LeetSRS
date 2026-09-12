import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fakeBrowser } from 'wxt/testing/fake-browser';
import { storage } from 'wxt/utils/storage';
import { translations } from '@/i18n';
import { STORAGE_KEYS } from '@/infrastructure/storage/storage-keys';
import {
  getDocumentTranslations,
  getStoredTranslations,
  watchDocumentTranslations,
  watchStoredTranslations,
} from '../translations';

describe.each([
  {
    source: 'legacy language',
    key: STORAGE_KEYS.language,
    read: getStoredTranslations,
    watch: watchStoredTranslations,
    storedValue: (language: unknown): unknown => language,
  },
  {
    source: 'learning document',
    key: STORAGE_KEYS.learningDocument,
    read: getDocumentTranslations,
    watch: watchDocumentTranslations,
    storedValue: (language: unknown): unknown => ({ schemaVersion: 6, cards: {}, stats: {}, settings: { language } }),
  },
])('stored translations from $source', ({ key, read, watch, storedValue }) => {
  beforeEach(() => {
    fakeBrowser.reset();
    fakeBrowser.runtime.id = 'test';
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
    fakeBrowser.reset();
  });

  describe('stored language', () => {
    it.each(['de', 'en', 'hi', 'pl', 'zh-CN'] as const)('uses stored language %s', async (language) => {
      await storage.setItem(key, storedValue(language));
      expect(await read()).toBe(translations[language]);
    });

    it.each(['xx-INVALID', 'toString', 'constructor', '__proto__', 42, null])(
      'falls back to browser language for %s',
      async (language) => {
        vi.stubGlobal('navigator', { languages: ['pl'] });
        await storage.setItem(key, storedValue(language));
        expect(await read()).toBe(translations.pl);
      }
    );
  });

  it('reads its source once and detects fallback after the storage read resolves', async () => {
    const languageRead = Promise.withResolvers<null>();
    const getItem = vi.spyOn(storage, 'getItem').mockReturnValueOnce(languageRead.promise);
    const languages = vi.fn(() => ['pl']);
    vi.stubGlobal('navigator', {
      get languages() {
        return languages();
      },
    });

    const pending = read();
    expect(getItem.mock.calls).toEqual([[key]]);
    expect(languages).not.toHaveBeenCalled();
    languageRead.resolve(null);
    expect(await pending).toBe(translations.pl);
    expect(languages).toHaveBeenCalledOnce();
  });

  it('uses stored language without accessing browser preferences', async () => {
    await storage.setItem(key, storedValue('de'));
    const languages = vi.fn(() => ['pl']);
    vi.stubGlobal('navigator', {
      get languages() {
        return languages();
      },
    });

    expect(await read()).toBe(translations.de);
    expect(languages).not.toHaveBeenCalled();
  });

  it('follows replacement with an omitted override using browser language', async () => {
    vi.stubGlobal('navigator', { languages: ['de'] });
    await storage.setItem(key, storedValue('pl'));
    const onChange = vi.fn();
    const stop = watch(onChange);
    try {
      await vi.waitFor(() => expect(onChange).toHaveBeenLastCalledWith(translations.pl));
      await storage.setItem(key, storedValue(undefined));
      await vi.waitFor(() => expect(onChange).toHaveBeenLastCalledWith(translations.de));
      expect(await read()).toBe(translations.de);
    } finally {
      stop();
    }
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

    await expect(read()).rejects.toBe(failure);
    expect(languages).not.toHaveBeenCalled();
  });

  it('loads once, follows language changes and removal, and stops after unsubscribe', async () => {
    await storage.setItem(key, storedValue('en'));
    vi.stubGlobal('navigator', { languages: ['de'] });
    const onChange = vi.fn();
    const onError = vi.fn();
    const getItem = vi.spyOn(storage, 'getItem');
    const stop = watch(onChange, onError);
    try {
      await vi.waitFor(() => expect(onChange).toHaveBeenLastCalledWith(translations.en));
      await storage.setItem(key, storedValue('pl'));
      await vi.waitFor(() => expect(onChange).toHaveBeenLastCalledWith(translations.pl));
      await storage.setItem(key, storedValue('toString'));
      await vi.waitFor(() => expect(onChange).toHaveBeenLastCalledWith(translations.de));
      await storage.removeItem(key);
      await vi.waitFor(() => expect(onChange).toHaveBeenLastCalledWith(translations.de));
      expect(getItem).toHaveBeenCalledOnce();
      expect(onError).not.toHaveBeenCalled();
    } finally {
      stop();
    }
    onChange.mockClear();
    await storage.setItem(key, storedValue('en'));
    expect(onChange).not.toHaveBeenCalled();
  });

  it('does not overwrite a storage change with an older initial read', async () => {
    const initial = Promise.withResolvers<unknown>();
    vi.spyOn(storage, 'getItem').mockReturnValueOnce(initial.promise);
    const onChange = vi.fn();
    const stop = watch(onChange, vi.fn());
    try {
      await storage.setItem(key, storedValue('pl'));
      await vi.waitFor(() => expect(onChange).toHaveBeenCalledWith(translations.pl));
      initial.resolve(storedValue('en'));
      await initial.promise;
      expect(onChange).toHaveBeenCalledOnce();
    } finally {
      stop();
    }
  });

  it('ignores an initial read that finishes after unsubscribe', async () => {
    const initial = Promise.withResolvers<unknown>();
    vi.spyOn(storage, 'getItem').mockReturnValueOnce(initial.promise);
    const onChange = vi.fn();
    const stop = watch(onChange, vi.fn());
    stop();
    initial.resolve(storedValue('en'));
    await initial.promise;
    expect(onChange).not.toHaveBeenCalled();
  });

  it('reports an initial read failure and still receives later changes', async () => {
    const error = new Error('storage unavailable');
    vi.spyOn(storage, 'getItem').mockRejectedValueOnce(error);
    const onChange = vi.fn();
    const onError = vi.fn();
    const stop = watch(onChange, onError);
    try {
      await vi.waitFor(() => expect(onError).toHaveBeenCalledWith(error));
      await storage.setItem(key, storedValue('pl'));
      await vi.waitFor(() => expect(onChange).toHaveBeenCalledWith(translations.pl));
    } finally {
      stop();
    }
  });

  it.each(['change', 'unsubscribe'] as const)('ignores an initial read failure after %s', async (event) => {
    const initial = Promise.withResolvers<unknown>();
    vi.spyOn(storage, 'getItem').mockReturnValueOnce(initial.promise);
    const onChange = vi.fn();
    const onError = vi.fn();
    const stop = watch(onChange, onError);
    try {
      if (event === 'unsubscribe') {
        stop();
      } else {
        await storage.setItem(key, storedValue('pl'));
        await vi.waitFor(() => expect(onChange).toHaveBeenCalledWith(translations.pl));
      }
      initial.reject(new Error('Late failure'));
      await initial.promise.catch(() => {});
      expect(onError).not.toHaveBeenCalled();
    } finally {
      stop();
    }
  });
});
