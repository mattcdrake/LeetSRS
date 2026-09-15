import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fakeBrowser } from 'wxt/testing/fake-browser';
import { storage } from 'wxt/utils/storage';
import { watchDocumentTranslations as watch } from '@/content/translations';
import { translations } from '@/shared/i18n/index';
import { LEARNING_DOCUMENT_VERSION } from '@/shared/models';
import { STORAGE_KEYS } from '@/shared/storage';

const key = STORAGE_KEYS.learningDocument;
const storedValue = (language: unknown) => ({
  schemaVersion: LEARNING_DOCUMENT_VERSION,
  cards: {},
  reviewActivity: null,
  settings: { language },
});

describe('stored translations from the learning document', () => {
  beforeEach(() => {
    fakeBrowser.reset();
    fakeBrowser.runtime.id = 'test';
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
    fakeBrowser.reset();
  });

  it.each(['de', 'hi', 'pl'])('uses English for an unmigrated %s preference', async (language) => {
    vi.stubGlobal('navigator', { languages: ['zh-CN'] });
    await storage.setItem(key, { ...storedValue(language), schemaVersion: 10 });
    const onChange = vi.fn();
    const stop = watch(onChange);
    try {
      await vi.waitFor(() => expect(onChange).toHaveBeenLastCalledWith(translations.en));
    } finally {
      stop();
    }
  });

  it('loads once, follows language changes and removal, and stops after unsubscribe', async () => {
    await storage.setItem(key, storedValue('en'));
    vi.stubGlobal('navigator', { languages: ['zh-CN'] });
    const onChange = vi.fn();
    const onError = vi.fn();
    const getItem = vi.spyOn(storage, 'getItem');
    const stop = watch(onChange, onError);
    try {
      await vi.waitFor(() => expect(onChange).toHaveBeenLastCalledWith(translations.en));
      await storage.setItem(key, storedValue('zh-CN'));
      await vi.waitFor(() => expect(onChange).toHaveBeenLastCalledWith(translations['zh-CN']));
      await storage.setItem(key, storedValue('toString'));
      await vi.waitFor(() => expect(onChange).toHaveBeenLastCalledWith(translations.en));
      await storage.removeItem(key);
      await vi.waitFor(() => expect(onChange).toHaveBeenLastCalledWith(translations['zh-CN']));
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
      await storage.setItem(key, storedValue('zh-CN'));
      await vi.waitFor(() => expect(onChange).toHaveBeenCalledWith(translations['zh-CN']));
      initial.resolve(storedValue('en'));
      await initial.promise;
      expect(onChange).toHaveBeenCalledOnce();
    } finally {
      stop();
    }
  });

  it('reports an initial read failure and still receives later changes', async () => {
    const error = new Error('storage unavailable');
    vi.spyOn(storage, 'getItem').mockRejectedValueOnce(error);
    const onChange = vi.fn();
    const onError = vi.fn();
    const stop = watch(onChange, onError);
    try {
      await vi.waitFor(() => expect(onError).toHaveBeenCalledWith(error));
      await storage.setItem(key, storedValue('zh-CN'));
      await vi.waitFor(() => expect(onChange).toHaveBeenCalledWith(translations['zh-CN']));
    } finally {
      stop();
    }
  });
});
