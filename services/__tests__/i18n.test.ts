import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { fakeBrowser } from 'wxt/testing/fake-browser';
import { storage } from 'wxt/utils/storage';
import { translations } from '@/shared/i18n';
import { getServiceTranslations } from '../i18n';
import { STORAGE_KEYS } from '../storage-keys';

describe('service i18n', () => {
  beforeEach(() => {
    fakeBrowser.reset();
    fakeBrowser.runtime.id = 'test';
  });

  afterEach(() => {
    fakeBrowser.reset();
  });

  describe('getServiceTranslations', () => {
    it('should return translations object', async () => {
      const t = await getServiceTranslations();
      expect(t).toBeDefined();
      expect(t.app.name).toBe('LeetSRS');
    });

    it('should have all required translation keys', async () => {
      const t = await getServiceTranslations();
      expect(t.settings.gistSync.gistDescription).toBeDefined();
      expect(typeof t.settings.gistSync.gistDescription).toBe('string');
    });
  });

  describe('stored language', () => {
    it('should use the current stored language', async () => {
      await storage.setItem(STORAGE_KEYS.language, 'en');
      const t = await getServiceTranslations();
      expect(t).toBe(translations.en);
    });

    it('should fall back to default language for invalid storage values', async () => {
      // Simulate corrupted/invalid language in storage
      await storage.setItem(STORAGE_KEYS.language, 'xx-INVALID');
      expect(await getServiceTranslations()).toBe(translations.en);
    });
  });
});
