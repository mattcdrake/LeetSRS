import { createEmptyCard, Rating } from 'ts-fsrs';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { fakeBrowser } from 'wxt/testing/fake-browser';
import { storage } from 'wxt/utils/storage';
import type { Note } from '@/shared/notes';
import type { DailyStats } from '@/shared/stats';
import { buildSettings } from '@/test/utils/settings-mocks';
import type { StoredCard } from '../cards';
import { applyImportData, exportData, importData, prepareImportData, resetAllData } from '../import-export';
import { migrations, runMigrations, setSchemaVersion } from '../migrations';
import { STORAGE_KEYS } from '../storage-keys';

describe('import-export', () => {
  const legacyMonthlyStatsKey = 'local:leetsrs:monthlyStats';

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
          domain: 'leetcode.com',
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

      const mockSettings = buildSettings({
        maxNewCardsPerDay: 5,
        dayStartHour: 4,
        theme: 'dark',
        resetEditorOnEveryProblem: true,
        resetEditorOnDueReview: true,
        badgeEnabled: true,
        language: 'en',
      });

      // Set up storage with mock data
      await storage.setItem(STORAGE_KEYS.cards, mockCards);
      await storage.setItem(STORAGE_KEYS.stats, mockStats);
      await storage.setItem(`${STORAGE_KEYS.notes}:${cardUuid}` as const, mockNotes[cardUuid]);
      await storage.setItem(STORAGE_KEYS.maxNewCardsPerDay, mockSettings.maxNewCardsPerDay);
      await storage.setItem(STORAGE_KEYS.dayStartHour, mockSettings.dayStartHour);
      await storage.setItem(STORAGE_KEYS.theme, mockSettings.theme);
      await storage.setItem(STORAGE_KEYS.resetEditorOnEveryProblem, mockSettings.resetEditorOnEveryProblem);
      await storage.setItem(STORAGE_KEYS.resetEditorOnDueReview, mockSettings.resetEditorOnDueReview);
      await storage.setItem(STORAGE_KEYS.badgeEnabled, mockSettings.badgeEnabled);
      await storage.setItem(STORAGE_KEYS.language, mockSettings.language);

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
      expect(parsed.data.monthlyStats).toBeUndefined();
    });

    it('should export schema version 2 after migrations run', async () => {
      await runMigrations(migrations);
      const parsed = JSON.parse(await exportData());
      expect(parsed.schemaVersion).toBe(2);
    });

    it('does not export legacy monthly stats', async () => {
      await storage.setItem(legacyMonthlyStatsKey, { '2024-01': { totalReviews: 15 } });

      const parsed = JSON.parse(await exportData());

      expect(parsed.data.monthlyStats).toBeUndefined();
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
            domain: 'leetcode.com',
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
        settings: buildSettings({
          maxNewCardsPerDay: 5,
          dayStartHour: 2,
          theme: 'light',
          resetEditorOnEveryProblem: true,
          resetEditorOnDueReview: true,
          badgeEnabled: false,
          language: 'en',
        }),
      },
    };

    describe('prepareImportData', () => {
      it('normalizes legacy settings without mutating storage', async () => {
        const existingCards = { existing: { id: 'existing-card-id' } };
        await storage.setItem(STORAGE_KEYS.cards, existingCards);
        const { resetEditorOnEveryProblem: _, ...legacySettings } = validExportData.data.settings;
        const legacyData = {
          ...validExportData,
          dataUpdatedAt: '2024-01-15T10:00:00.000Z',
          data: {
            ...validExportData.data,
            settings: { ...legacySettings, animationsEnabled: false, autoClearLeetcode: true },
          },
        };

        const serializedLegacyData = JSON.stringify(legacyData);
        const parsedLegacyData = JSON.parse(serializedLegacyData);
        const preparedData = await prepareImportData(serializedLegacyData);

        expect(preparedData).toMatchObject({
          cards: parsedLegacyData.data.cards,
          stats: parsedLegacyData.data.stats,
          notes: parsedLegacyData.data.notes,
          settings: { ...legacySettings, resetEditorOnEveryProblem: true },
          dataUpdatedAt: '2024-01-15T10:00:00.000Z',
        });
        expect(preparedData.settings).not.toHaveProperty('animationsEnabled');
        expect(preparedData.settings).not.toHaveProperty('autoClearLeetcode');
        expect(await storage.getItem(STORAGE_KEYS.cards)).toEqual(existingCards);
      });

      it.each([
        ['invalid JSON', 'invalid json', 'Invalid JSON format'],
        ['invalid structure', JSON.stringify({ data: {} }), 'Invalid export data structure'],
        [
          'newer schema',
          JSON.stringify({ ...validExportData, schemaVersion: 999 }),
          'Export is from a newer version (schema 999). Please update the extension.',
        ],
        [
          'invalid cards',
          JSON.stringify({ ...validExportData, data: { ...validExportData.data, cards: null } }),
          'Invalid cards data',
        ],
        [
          'invalid stats',
          JSON.stringify({ ...validExportData, data: { ...validExportData.data, stats: null } }),
          'Invalid stats data',
        ],
        [
          'invalid notes',
          JSON.stringify({ ...validExportData, data: { ...validExportData.data, notes: null } }),
          'Invalid notes data',
        ],
        [
          'invalid current setting',
          JSON.stringify({
            ...validExportData,
            data: {
              ...validExportData.data,
              settings: { ...validExportData.data.settings, dayStartHour: 99 },
            },
          }),
          'Day start hour must be between 0 and 23',
        ],
        [
          'invalid legacy setting',
          JSON.stringify({
            ...validExportData,
            data: {
              ...validExportData.data,
              settings: {
                ...validExportData.data.settings,
                resetEditorOnEveryProblem: undefined,
                autoClearLeetcode: 'yes',
              },
            },
          }),
          'Reset editor on every problem must be a boolean',
        ],
      ])('rejects %s before changing existing storage', async (_name, jsonData, error) => {
        const existingCards = { existing: { id: 'existing-card-id' } };
        const existingStats = { '2024-02-01': { totalReviews: 7 } };
        const existingNote = { text: 'existing note' };
        await storage.setItem(STORAGE_KEYS.cards, existingCards);
        await storage.setItem(STORAGE_KEYS.stats, existingStats);
        await storage.setItem(`${STORAGE_KEYS.notes}:existing-card-id`, existingNote);
        await storage.setItem(STORAGE_KEYS.theme, 'dark');
        await storage.setItem(STORAGE_KEYS.gistId, 'existing-gist');
        await storage.setItem(STORAGE_KEYS.gistSyncEnabled, true);
        await storage.setItem(STORAGE_KEYS.githubPat, 'existing-pat');

        await expect(prepareImportData(jsonData)).rejects.toThrow(error);

        expect(await storage.getItem(STORAGE_KEYS.cards)).toEqual(existingCards);
        expect(await storage.getItem(STORAGE_KEYS.stats)).toEqual(existingStats);
        expect(await storage.getItem(`${STORAGE_KEYS.notes}:existing-card-id`)).toEqual(existingNote);
        expect(await storage.getItem(STORAGE_KEYS.theme)).toBe('dark');
        expect(await storage.getItem(STORAGE_KEYS.gistId)).toBe('existing-gist');
        expect(await storage.getItem(STORAGE_KEYS.gistSyncEnabled)).toBe(true);
        expect(await storage.getItem(STORAGE_KEYS.githubPat)).toBe('existing-pat');
      });
    });

    describe('applyImportData', () => {
      it('replaces stored data while preserving the GitHub PAT', async () => {
        const oldCardUuid = 'old-card-uuid-1234';
        await storage.setItem(STORAGE_KEYS.cards, { old: { id: oldCardUuid } });
        await storage.setItem(`${STORAGE_KEYS.notes}:${oldCardUuid}` as const, { text: 'old note' });
        await storage.setItem(STORAGE_KEYS.githubPat, 'existing-pat');
        const preparedData = await prepareImportData(
          JSON.stringify({
            ...validExportData,
            dataUpdatedAt: '2024-01-15T10:00:00.000Z',
            data: {
              ...validExportData.data,
              gistSync: { gistId: 'imported-gist', enabled: true },
            },
          })
        );

        await applyImportData(preparedData);

        expect(await storage.getItem(STORAGE_KEYS.cards)).toEqual(validExportData.data.cards);
        expect(await storage.getItem(`${STORAGE_KEYS.notes}:${oldCardUuid}` as const)).toBeNull();
        expect(await storage.getItem(STORAGE_KEYS.githubPat)).toBe('existing-pat');
        expect(await storage.getItem(STORAGE_KEYS.gistId)).toBe('imported-gist');
        expect(await storage.getItem(STORAGE_KEYS.gistSyncEnabled)).toBe(true);
        expect(await storage.getItem(STORAGE_KEYS.dataUpdatedAt)).toBe('2024-01-15T10:00:00.000Z');
      });
    });

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
      expect(await storage.getItem(STORAGE_KEYS.theme)).toEqual('light');
      expect(await storage.getItem(STORAGE_KEYS.resetEditorOnEveryProblem)).toEqual(true);
      expect(await storage.getItem(STORAGE_KEYS.resetEditorOnDueReview)).toEqual(true);
      expect(await storage.getItem(STORAGE_KEYS.badgeEnabled)).toEqual(false);
      expect(await storage.getItem(STORAGE_KEYS.language)).toEqual('en');
    });

    it.each(['system', 'light', 'dark'] as const)('should round-trip the %s theme', async (theme) => {
      const data = {
        ...validExportData,
        data: {
          ...validExportData.data,
          settings: { ...validExportData.data.settings, theme },
        },
      };

      await importData(JSON.stringify(data));

      expect(await storage.getItem(STORAGE_KEYS.theme)).toBe(theme);
      expect(JSON.parse(await exportData()).data.settings.theme).toBe(theme);
    });

    it('should preserve the imported data update timestamp', async () => {
      const dataUpdatedAt = '2024-01-15T10:00:00.000Z';
      await importData(JSON.stringify({ ...validExportData, dataUpdatedAt }));
      expect(await storage.getItem(STORAGE_KEYS.dataUpdatedAt)).toBe(dataUpdatedAt);
    });

    it('should generate a data update timestamp when the import omits it', async () => {
      await importData(JSON.stringify(validExportData));

      expect(await storage.getItem(STORAGE_KEYS.dataUpdatedAt)).toMatch(/^\d{4}-\d{2}-\d{2}T/);
    });

    it('should preserve the existing GitHub PAT', async () => {
      await storage.setItem(STORAGE_KEYS.githubPat, 'existing-pat');

      await importData(JSON.stringify(validExportData));

      expect(await storage.getItem(STORAGE_KEYS.githubPat)).toBe('existing-pat');
    });

    it('should import the legacy autoClearLeetcode setting', async () => {
      const { resetEditorOnEveryProblem: _, ...legacySettings } = validExportData.data.settings;
      const legacyData = {
        ...validExportData,
        data: {
          ...validExportData.data,
          settings: { ...legacySettings, autoClearLeetcode: true },
        },
      };

      await importData(JSON.stringify(legacyData));

      expect(await storage.getItem(STORAGE_KEYS.resetEditorOnEveryProblem)).toBe(true);
    });

    it('should ignore the legacy animationsEnabled setting', async () => {
      const legacyData = {
        ...validExportData,
        data: {
          ...validExportData.data,
          settings: { ...validExportData.data.settings, animationsEnabled: false },
        },
      };

      await importData(JSON.stringify(legacyData));

      expect(JSON.parse(await exportData()).data.settings).toEqual(validExportData.data.settings);
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

    it('should leave existing data unchanged when imported settings are invalid', async () => {
      const existingCards = { 'existing-card': { id: 'existing-card-id' } };
      const existingStats = { '2024-02-01': { totalReviews: 7 } };
      const existingNote = { text: 'existing note' };
      await storage.setItem(STORAGE_KEYS.cards, existingCards);
      await storage.setItem(STORAGE_KEYS.stats, existingStats);
      await storage.setItem(`${STORAGE_KEYS.notes}:existing-card-id`, existingNote);
      await storage.setItem(STORAGE_KEYS.theme, 'dark');

      const invalidImport = {
        ...validExportData,
        data: {
          ...validExportData.data,
          settings: { ...validExportData.data.settings, dayStartHour: 99 },
        },
      };

      await expect(importData(JSON.stringify(invalidImport))).rejects.toThrow(
        'Day start hour must be between 0 and 23'
      );
      expect(await storage.getItem(STORAGE_KEYS.cards)).toEqual(existingCards);
      expect(await storage.getItem(STORAGE_KEYS.stats)).toEqual(existingStats);
      expect(await storage.getItem(`${STORAGE_KEYS.notes}:existing-card-id`)).toEqual(existingNote);
      expect(await storage.getItem(STORAGE_KEYS.theme)).toBe('dark');
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

    it('should reject a system-theme export on a schema version 1 client', async () => {
      await setSchemaVersion(1);
      const systemThemeExport = {
        ...validExportData,
        schemaVersion: 2,
        data: {
          ...validExportData.data,
          settings: { ...validExportData.data.settings, theme: 'system' },
        },
      };

      await expect(importData(JSON.stringify(systemThemeExport))).rejects.toThrow(
        'Export is from a newer version (schema 2). Please update the extension.'
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

    it('accepts and ignores legacy monthly stats', async () => {
      const existingMonthlyStats = { '2023-12': { totalReviews: 5 } };
      await storage.setItem(legacyMonthlyStatsKey, existingMonthlyStats);
      const dataWithMonthly = {
        ...validExportData,
        data: { ...validExportData.data, monthlyStats: { '2024-01': { totalReviews: 20 } } },
      };

      await expect(importData(JSON.stringify(dataWithMonthly))).resolves.not.toThrow();

      expect(await storage.getItem(legacyMonthlyStatsKey)).toEqual(existingMonthlyStats);
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
      const legacyMonthlyStats = { '2023-12': { totalReviews: 5 } };
      await storage.setItem(legacyMonthlyStatsKey, legacyMonthlyStats);
      await storage.setItem(STORAGE_KEYS.maxNewCardsPerDay, 5);
      await storage.setItem(STORAGE_KEYS.dayStartHour, 3);
      await storage.setItem(STORAGE_KEYS.theme, 'dark');
      await storage.setItem(STORAGE_KEYS.resetEditorOnEveryProblem, true);
      await storage.setItem(STORAGE_KEYS.resetEditorOnDueReview, true);
      await storage.setItem(STORAGE_KEYS.badgeEnabled, true);
      await storage.setItem(STORAGE_KEYS.language, 'en');
      await storage.setItem(`${STORAGE_KEYS.notes}:${uuid1}` as const, { text: 'note 1' });
      await storage.setItem(`${STORAGE_KEYS.notes}:${uuid2}` as const, { text: 'note 2' });

      await resetAllData();

      // Verify all data was removed
      expect(await storage.getItem(STORAGE_KEYS.cards)).toBeNull();
      expect(await storage.getItem(STORAGE_KEYS.stats)).toBeNull();
      expect(await storage.getItem(legacyMonthlyStatsKey)).toEqual(legacyMonthlyStats);
      expect(await storage.getItem(STORAGE_KEYS.maxNewCardsPerDay)).toBeNull();
      expect(await storage.getItem(STORAGE_KEYS.dayStartHour)).toBeNull();
      expect(await storage.getItem(STORAGE_KEYS.theme)).toBeNull();
      expect(await storage.getItem(STORAGE_KEYS.resetEditorOnEveryProblem)).toBeNull();
      expect(await storage.getItem(STORAGE_KEYS.resetEditorOnDueReview)).toBeNull();
      expect(await storage.getItem(STORAGE_KEYS.badgeEnabled)).toBeNull();
      expect(await storage.getItem(STORAGE_KEYS.language)).toBeNull();
      expect(await storage.getItem(`${STORAGE_KEYS.notes}:${uuid1}` as const)).toBeNull();
      expect(await storage.getItem(`${STORAGE_KEYS.notes}:${uuid2}` as const)).toBeNull();
    });
  });
});
