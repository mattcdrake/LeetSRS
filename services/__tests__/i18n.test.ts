import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { fakeBrowser } from 'wxt/testing';
import { storage } from 'wxt/utils/storage';
import { getServiceTranslations, getServiceLanguage } from '../i18n';
import { STORAGE_KEYS } from '../storage-keys';
import { translations } from '@/shared/i18n';

describe('service i18n', () => {
  beforeEach(() => {
    fakeBrowser.reset();
    fakeBrowser.runtime.id = 'test';
  });

  afterEach(() => {
    fakeBrowser.reset();
  });

  describe('getServiceTranslations', () => {
    it('should return translations object', () => {
      const t = getServiceTranslations();
      expect(t).toBeDefined();
      expect(t.app.name).toBe('LeetSRS');
    });

    it('should have all required translation keys', () => {
      const t = getServiceTranslations();
      expect(t.settings.gistSync.gistDescription).toBeDefined();
      expect(typeof t.settings.gistSync.gistDescription).toBe('string');
    });
  });

  describe('getServiceLanguage', () => {
    it('should return a valid language code', () => {
      const language = getServiceLanguage();
      expect(language).toBe('en');
    });
  });

  describe('storage watching', () => {
    it('should be set up to watch for language changes', async () => {
      // Verify the service is functional with storage
      await storage.setItem(STORAGE_KEYS.language, 'en');
      const t = getServiceTranslations();
      expect(t).toBe(translations.en);
    });

    it('should fall back to default language for invalid storage values', async () => {
      // Simulate corrupted/invalid language in storage
      await storage.setItem(STORAGE_KEYS.language, 'xx-INVALID' as any);
      // Wait for the watcher to fire
      await new Promise((r) => setTimeout(r, 50));
      expect(getServiceLanguage()).toBe('en');
      expect(getServiceTranslations()).toBe(translations.en);
    });
  });
});
