import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { fakeBrowser } from 'wxt/testing';
import { storage } from 'wxt/utils/storage';
import { exportData, importData, resetAllData } from '../import-export';
import { STORAGE_KEYS } from '../storage-keys';
import { type StoredCard } from '../cards';
import { type DailyStats } from '../stats';
import { type Note } from '@/shared/notes';
import { Rating, createEmptyCard } from 'ts-fsrs';
import { APP_VERSION } from '@/shared/config';

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
      const mockCards: Record<string, StoredCard> = {
        'problem-1': {
          id: 'problem-1',
          slug: 'problem-1',
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
        'problem-1': { text: 'Use hash map for O(n) solution' },
      };

      const mockSettings = {
        maxNewCardsPerDay: 5,
        animationsEnabled: true,
        theme: 'dark' as const,
        enableLeetCodeButton: false,
      };

      // Set up storage with mock data
      await storage.setItem(STORAGE_KEYS.cards, mockCards);
      await storage.setItem(STORAGE_KEYS.stats, mockStats);
      await storage.setItem(`${STORAGE_KEYS.notes}:problem-1` as const, mockNotes['problem-1']);
      await storage.setItem(STORAGE_KEYS.maxNewCardsPerDay, mockSettings.maxNewCardsPerDay);
      await storage.setItem(STORAGE_KEYS.animationsEnabled, mockSettings.animationsEnabled);
      await storage.setItem(STORAGE_KEYS.theme, mockSettings.theme);
      await storage.setItem(STORAGE_KEYS.enableLeetCodeButton, mockSettings.enableLeetCodeButton);

      const result = await exportData();
      const parsed = JSON.parse(result);

      expect(parsed.version).toBe(APP_VERSION);
      expect(parsed.exportDate).toMatch(/^\d{4}-\d{2}-\d{2}T/);
      expect(parsed.data.stats).toEqual(mockStats);
      expect(parsed.data.notes).toEqual(mockNotes);
      expect(parsed.data.settings).toEqual(mockSettings);

      // Check cards separately since FSRS properties might differ
      expect(Object.keys(parsed.data.cards)).toEqual(['problem-1']);
      const exportedCard = parsed.data.cards['problem-1'];
      expect(exportedCard.id).toBe('problem-1');
      expect(exportedCard.slug).toBe('problem-1');
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
        version: APP_VERSION,
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
    const validExportData = {
      version: APP_VERSION,
      exportDate: '2024-01-01T00:00:00.000Z',
      data: {
        cards: {
          'problem-1': {
            id: 'problem-1',
            slug: 'problem-1',
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
          'problem-1': { text: 'Use hash map' },
        },
        settings: {
          maxNewCardsPerDay: 5,
          animationsEnabled: false,
          theme: 'light' as const,
          enableLeetCodeButton: true,
        },
      },
    };

    it('should import valid data successfully', async () => {
      const jsonData = JSON.stringify(validExportData);
      await importData(jsonData);

      // Verify data was imported correctly
      expect(await storage.getItem(STORAGE_KEYS.cards)).toEqual(validExportData.data.cards);
      expect(await storage.getItem(STORAGE_KEYS.stats)).toEqual(validExportData.data.stats);
      expect(await storage.getItem(`${STORAGE_KEYS.notes}:problem-1` as const)).toEqual(
        validExportData.data.notes['problem-1']
      );
      expect(await storage.getItem(STORAGE_KEYS.maxNewCardsPerDay)).toEqual(5);
      expect(await storage.getItem(STORAGE_KEYS.animationsEnabled)).toEqual(false);
      expect(await storage.getItem(STORAGE_KEYS.theme)).toEqual('light');
      expect(await storage.getItem(STORAGE_KEYS.enableLeetCodeButton)).toEqual(true);
    });

    it('should clear existing data before importing', async () => {
      // Set up existing data
      await storage.setItem(STORAGE_KEYS.cards, { 'old-card': { id: 'old-card' } });
      await storage.setItem(STORAGE_KEYS.stats, { '2023-12-31': { totalReviews: 10 } });
      await storage.setItem(`${STORAGE_KEYS.notes}:old-card` as const, { text: 'old note' });

      const jsonData = JSON.stringify(validExportData);
      await importData(jsonData);

      // Verify old data was cleared
      expect(await storage.getItem(`${STORAGE_KEYS.notes}:old-card` as const)).toBeNull();

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

    it('should throw error for unsupported version', async () => {
      const wrongVersion = { ...validExportData, version: '2.0.0' };
      await expect(importData(JSON.stringify(wrongVersion))).rejects.toThrow('Unsupported export version: 2.0.0');
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
      const mockCards = {
        'problem-1': { id: 'problem-1' },
        'problem-2': { id: 'problem-2' },
      };
      await storage.setItem(STORAGE_KEYS.cards, mockCards);
      await storage.setItem(STORAGE_KEYS.stats, { '2024-01-01': {} });
      await storage.setItem(STORAGE_KEYS.maxNewCardsPerDay, 5);
      await storage.setItem(STORAGE_KEYS.animationsEnabled, true);
      await storage.setItem(STORAGE_KEYS.theme, 'dark');
      await storage.setItem(STORAGE_KEYS.enableLeetCodeButton, false);
      await storage.setItem(`${STORAGE_KEYS.notes}:problem-1` as const, { text: 'note 1' });
      await storage.setItem(`${STORAGE_KEYS.notes}:problem-2` as const, { text: 'note 2' });

      await resetAllData();

      // Verify all data was removed
      expect(await storage.getItem(STORAGE_KEYS.cards)).toBeNull();
      expect(await storage.getItem(STORAGE_KEYS.stats)).toBeNull();
      expect(await storage.getItem(STORAGE_KEYS.maxNewCardsPerDay)).toBeNull();
      expect(await storage.getItem(STORAGE_KEYS.animationsEnabled)).toBeNull();
      expect(await storage.getItem(STORAGE_KEYS.theme)).toBeNull();
      expect(await storage.getItem(STORAGE_KEYS.enableLeetCodeButton)).toBeNull();
      expect(await storage.getItem(`${STORAGE_KEYS.notes}:problem-1` as const)).toBeNull();
      expect(await storage.getItem(`${STORAGE_KEYS.notes}:problem-2` as const)).toBeNull();
    });
  });
});
