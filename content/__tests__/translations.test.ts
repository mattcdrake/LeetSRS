import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fakeBrowser } from 'wxt/testing/fake-browser';
import { storage } from 'wxt/utils/storage';
import { watchDocumentTranslations as watch } from '@/content/translations';
import { translations } from '@/shared/i18n/index';
import { LEARNING_DOCUMENT_VERSION } from '@/shared/models';
import { learningDocumentItem } from '@/shared/storage';

const key = learningDocumentItem.key;
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

  it('loads once, follows language changes and removal, and stops after unsubscribe', async () => {
    await storage.setItem(key, storedValue('en'));
    vi.stubGlobal('navigator', { languages: ['zh-CN'] });
    const onChange = vi.fn();
    const onError = vi.fn();
    const getItem = vi.spyOn(learningDocumentItem, 'getValue');
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
    vi.spyOn(learningDocumentItem, 'getValue').mockReturnValueOnce(initial.promise);
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
    vi.spyOn(learningDocumentItem, 'getValue').mockRejectedValueOnce(error);
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
