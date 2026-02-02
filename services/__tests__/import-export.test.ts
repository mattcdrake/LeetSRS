import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { fakeBrowser } from 'wxt/testing';
import { storage } from 'wxt/utils/storage';
import { exportData, importData, resetAllData } from '../import-export';
import { STORAGE_KEYS } from '../storage-keys';
import { type StoredCard } from '../cards';
import { type DailyStats } from '../stats';
import { type Note } from '@/shared/notes';
import { Rating, createEmptyCard } from 'ts-fsrs';

describe('import-export', () => {
  beforeEach(() => {
    fakeBrowser.reset();
    fakeBrowser.runtime.id = 'test';
  });

  afterEach(() => {
    fakeBrowser.reset();
  });

  describe('exportData', () => {
    it('should export all data with correct structure', async () => {
      const cardUuid = 'a1b2c3d4-e5f6-7890-abcd-ef1234567890';
      const mockCards: Record<string, StoredCard> = {
        'two-sum': {
          id: cardUuid,
          slug: 'two-sum',
          name: 'Two Sum',
          leetcodeId: '1',
          difficulty: 'Easy',
          createdAt: Date.now(),
          paused: false,
          fsrs: {
            ...createEmptyCard(),
            due: Date.now(),
          },
        },
      };

      const mockStats: Record<string, DailyStats> = {
        '2024-01-01': {
          date: '2024-01-01',
          totalReviews: 5,
          gradeBreakdown: {
            [Rating.Again]: 1,
            [Rating.Hard]: 1,
            [Rating.Good]: 2,
            [Rating.Easy]: 1,
          },
          newCards: 2,
          reviewedCards: 3,
          streak: 1,
        },
      };

      const mockNotes: Record<string, Note> = {
        [cardUuid]: { text: 'Use hash map for O(n) solution' },
      };

      const mockSettings = {
        maxNewCardsPerDay: 5,
        dayStartHour: 4,
        animationsEnabled: true,
        theme: 'dark' as const,
        autoClearLeetcode: true,
        badgeEnabled: true,
      };

      // Set up storage with mock data
      await storage.setItem(STORAGE_KEYS.cards, mockCards);
      await storage.setItem(STORAGE_KEYS.stats, mockStats);
      await storage.setItem(`${STORAGE_KEYS.notes}:${cardUuid}` as const, mockNotes[cardUuid]);
      await storage.setItem(STORAGE_KEYS.maxNewCardsPerDay, mockSettings.maxNewCardsPerDay);
      await storage.setItem(STORAGE_KEYS.dayStartHour, mockSettings.dayStartHour);
      await storage.setItem(STORAGE_KEYS.animationsEnabled, mockSettings.animationsEnabled);
      await storage.setItem(STORAGE_KEYS.theme, mockSettings.theme);
      await storage.setItem(STORAGE_KEYS.autoClearLeetcode, mockSettings.autoClearLeetcode);
      await storage.setItem(STORAGE_KEYS.badgeEnabled, mockSettings.badgeEnabled);

      const result = await exportData();
      const parsed = JSON.parse(result);

      expect(parsed.schemaVersion).toBe(0);
      expect(parsed.exportDate).toMatch(/^\d{4}-\d{2}-\d{2}T/);
      expect(parsed.data.stats).toEqual(mockStats);
      expect(parsed.data.notes).toEqual(mockNotes);
      expect(parsed.data.settings).toEqual(mockSettings);

      // Check cards separately since FSRS properties might differ
      expect(Object.keys(parsed.data.cards)).toEqual(['two-sum']);
      const exportedCard = parsed.data.cards['two-sum'];
      expect(exportedCard.id).toBe(cardUuid);
      expect(exportedCard.slug).toBe('two-sum');
      expect(exportedCard.name).toBe('Two Sum');
      expect(exportedCard.leetcodeId).toBe('1');
      expect(exportedCard.difficulty).toBe('Easy');
      expect(exportedCard.paused).toBe(false);
      expect(exportedCard.fsrs.state).toBe(0);
      expect(exportedCard.fsrs.due).toBeGreaterThan(0);
    });

    it('should handle empty data gracefully', async () => {
      // Storage is already empty from beforeEach
      const result = await exportData();
      const parsed = JSON.parse(result);

      expect(parsed).toMatchObject({
        schemaVersion: 0,
        exportDate: expect.any(String),
        data: {
          cards: {},
          stats: {},
          notes: {},
          settings: {},
        },
      });
    });
  });

  describe('importData', () => {
    const cardUuid = 'b2c3d4e5-f6a7-8901-bcde-f23456789012';
    const validExportData = {
      schemaVersion: 0,
      exportDate: '2024-01-01T00:00:00.000Z',
      data: {
        cards: {
          'two-sum': {
            id: cardUuid,
            slug: 'two-sum',
            name: 'Two Sum',
            leetcodeId: '1',
            difficulty: 'Easy',
            createdAt: Date.now(),
            paused: false,
            fsrs: {
              ...createEmptyCard(),
              due: Date.now(),
            },
          },
        },
        stats: {
          '2024-01-01': {
            date: '2024-01-01',
            totalReviews: 5,
            gradeBreakdown: {
              [Rating.Again]: 1,
              [Rating.Hard]: 1,
              [Rating.Good]: 2,
              [Rating.Easy]: 1,
            },
            newCards: 2,
            reviewedCards: 3,
            streak: 1,
          },
        },
        notes: {
          [cardUuid]: { text: 'Use hash map' },
        },
        settings: {
          maxNewCardsPerDay: 5,
          dayStartHour: 2,
          animationsEnabled: false,
          theme: 'light' as const,
          autoClearLeetcode: true,
          badgeEnabled: false,
        },
      },
    };

    it('should import valid data successfully', async () => {
      const jsonData = JSON.stringify(validExportData);
      await importData(jsonData);

      // Verify data was imported correctly
      expect(await storage.getItem(STORAGE_KEYS.cards)).toEqual(validExportData.data.cards);
      expect(await storage.getItem(STORAGE_KEYS.stats)).toEqual(validExportData.data.stats);
      expect(await storage.getItem(`${STORAGE_KEYS.notes}:${cardUuid}` as const)).toEqual(
        validExportData.data.notes[cardUuid]
      );
      expect(await storage.getItem(STORAGE_KEYS.maxNewCardsPerDay)).toEqual(5);
      expect(await storage.getItem(STORAGE_KEYS.dayStartHour)).toEqual(2);
      expect(await storage.getItem(STORAGE_KEYS.animationsEnabled)).toEqual(false);
      expect(await storage.getItem(STORAGE_KEYS.theme)).toEqual('light');
      expect(await storage.getItem(STORAGE_KEYS.autoClearLeetcode)).toEqual(true);
      expect(await storage.getItem(STORAGE_KEYS.badgeEnabled)).toEqual(false);
    });

    it('should clear existing data before importing', async () => {
      // Set up existing data
      const oldCardUuid = 'old-card-uuid-1234';
      await storage.setItem(STORAGE_KEYS.cards, { 'old-slug': { id: oldCardUuid } });
      await storage.setItem(STORAGE_KEYS.stats, { '2023-12-31': { totalReviews: 10 } });
      await storage.setItem(`${STORAGE_KEYS.notes}:${oldCardUuid}` as const, { text: 'old note' });

      const jsonData = JSON.stringify(validExportData);
      await importData(jsonData);

      // Verify old data was cleared
      expect(await storage.getItem(`${STORAGE_KEYS.notes}:${oldCardUuid}` as const)).toBeNull();

      // Verify only new data exists
      expect(await storage.getItem(STORAGE_KEYS.cards)).toEqual(validExportData.data.cards);
      expect(await storage.getItem(STORAGE_KEYS.stats)).toEqual(validExportData.data.stats);
    });

    it('should throw error for invalid JSON', async () => {
      await expect(importData('invalid json')).rejects.toThrow('Invalid JSON format');
    });

    it('should throw error for missing required fields', async () => {
      const invalidData = { data: {} };
      await expect(importData(JSON.stringify(invalidData))).rejects.toThrow('Invalid export data structure');
    });

    it('should throw error for newer schema version', async () => {
      const newerSchema = { ...validExportData, schemaVersion: 999 };
      await expect(importData(JSON.stringify(newerSchema))).rejects.toThrow(
        'Export is from a newer version (schema 999). Please update the extension.'
      );
    });

    it('should accept legacy exports without schemaVersion', async () => {
      // Legacy exports have 'version' instead of 'schemaVersion'
      const legacyExport = {
        version: '0.2.0', // Old format
        exportDate: '2024-01-01T00:00:00.000Z',
        data: {
          cards: {},
          stats: {},
          notes: {},
          settings: {},
        },
      };
      // Should not throw - legacy exports are treated as schema 0
      await expect(importData(JSON.stringify(legacyExport))).resolves.not.toThrow();
    });

    it('should throw error for invalid data types', async () => {
      const invalidCards = { ...validExportData, data: { ...validExportData.data, cards: null } };
      await expect(importData(JSON.stringify(invalidCards))).rejects.toThrow('Invalid cards data');
    });

    it('should handle empty data sections by clearing existing data', async () => {
      // Set up some existing data first
      await storage.setItem(STORAGE_KEYS.cards, { 'existing-card': {} });
      await storage.setItem(STORAGE_KEYS.stats, { '2024-01-01': {} });

      const emptyData = {
        ...validExportData,
        data: {
          cards: {},
          stats: {},
          notes: {},
          settings: {},
        },
      };

      await importData(JSON.stringify(emptyData));

      // Verify existing data was cleared and empty data was imported
      expect(await storage.getItem(STORAGE_KEYS.cards)).toEqual({});
      expect(await storage.getItem(STORAGE_KEYS.stats)).toEqual({});
    });
  });

  describe('resetAllData', () => {
    it('should remove all storage keys', async () => {
      // Set up some data first
      const uuid1 = 'c3d4e5f6-a7b8-9012-cdef-345678901234';
      const uuid2 = 'd4e5f6a7-b8c9-0123-defa-456789012345';
      const mockCards = {
        'two-sum': { id: uuid1 },
        'three-sum': { id: uuid2 },
      };
      await storage.setItem(STORAGE_KEYS.cards, mockCards);
      await storage.setItem(STORAGE_KEYS.stats, { '2024-01-01': {} });
      await storage.setItem(STORAGE_KEYS.maxNewCardsPerDay, 5);
      await storage.setItem(STORAGE_KEYS.dayStartHour, 3);
      await storage.setItem(STORAGE_KEYS.animationsEnabled, true);
      await storage.setItem(STORAGE_KEYS.theme, 'dark');
      await storage.setItem(STORAGE_KEYS.autoClearLeetcode, true);
      await storage.setItem(STORAGE_KEYS.badgeEnabled, true);
      await storage.setItem(`${STORAGE_KEYS.notes}:${uuid1}` as const, { text: 'note 1' });
      await storage.setItem(`${STORAGE_KEYS.notes}:${uuid2}` as const, { text: 'note 2' });

      await resetAllData();

      // Verify all data was removed
      expect(await storage.getItem(STORAGE_KEYS.cards)).toBeNull();
      expect(await storage.getItem(STORAGE_KEYS.stats)).toBeNull();
      expect(await storage.getItem(STORAGE_KEYS.maxNewCardsPerDay)).toBeNull();
      expect(await storage.getItem(STORAGE_KEYS.dayStartHour)).toBeNull();
      expect(await storage.getItem(STORAGE_KEYS.animationsEnabled)).toBeNull();
      expect(await storage.getItem(STORAGE_KEYS.theme)).toBeNull();
      expect(await storage.getItem(STORAGE_KEYS.autoClearLeetcode)).toBeNull();
      expect(await storage.getItem(STORAGE_KEYS.badgeEnabled)).toBeNull();
      expect(await storage.getItem(`${STORAGE_KEYS.notes}:${uuid1}` as const)).toBeNull();
      expect(await storage.getItem(`${STORAGE_KEYS.notes}:${uuid2}` as const)).toBeNull();
    });
  });
});
