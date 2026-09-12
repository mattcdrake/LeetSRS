import { createEmptyCard, Rating, State } from 'ts-fsrs';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fakeBrowser } from 'wxt/testing/fake-browser';
import { storage } from 'wxt/utils/storage';
import type { Card } from '@/domain/cards';
import { LEARNING_DOCUMENT_VERSION, type LearningDocument } from '@/domain/learning-document';
import type { DailyStats } from '@/domain/statistics';
import { parseBackup } from '@/infrastructure/storage/backup';
import { readGistConnection } from '@/infrastructure/storage/gist-connection';
import { readLearningDocument, replaceLearningDocument } from '@/infrastructure/storage/learning-document';
import { removeDayStart } from '@/infrastructure/storage/migrations/003-remove-day-start';
import { runStartupMigrations, setSchemaVersion } from '@/infrastructure/storage/migrations/runner';
import { STORAGE_KEYS } from '@/infrastructure/storage/storage-keys';
import { setGistSyncConfig } from '@/services/gist-sync';
import { malformedBackupCases, mixedRecordBackup } from '@/test/utils/backup-mocks';
import { createMockCard } from '@/test/utils/card-mocks';
import { buildSettings } from '@/test/utils/settings-mocks';
import * as documentBackup from '../document-import-export';
import { exportData, importData, resetAllData } from '../import-export';

describe('import-export', () => {
  const legacyMonthlyStatsKey = 'local:leetsrs:monthlyStats';

  beforeEach(() => {
    fakeBrowser.reset();
    fakeBrowser.runtime.id = 'test';
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.useRealTimers();
    fakeBrowser.reset();
  });

  describe('exportData', () => {
    it('should export all data with correct structure', async () => {
      const cardUuid = 'a1b2c3d4-e5f6-7890-abcd-ef1234567890';
      const mockCards: Record<string, Card> = {
        'two-sum': {
          id: cardUuid,
          note: 'Use hash map for O(n) solution',
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

      const mockSettings = buildSettings({
        maxNewCardsPerDay: 5,
        theme: 'dark',
        resetEditorOnEveryProblem: true,
        resetEditorOnDueReview: true,
        badgeEnabled: true,
        language: 'en',
      });

      // Set up storage with mock data
      await storage.setItem(STORAGE_KEYS.cards, mockCards);
      await storage.setItem(STORAGE_KEYS.stats, mockStats);
      await storage.setItem(STORAGE_KEYS.maxNewCardsPerDay, mockSettings.maxNewCardsPerDay);
      await storage.setItem('sync:leetsrs:dayStartHour', 4);
      await storage.setItem(STORAGE_KEYS.theme, mockSettings.theme);
      await storage.setItem(STORAGE_KEYS.resetEditorOnEveryProblem, mockSettings.resetEditorOnEveryProblem);
      await storage.setItem(STORAGE_KEYS.resetEditorOnDueReview, mockSettings.resetEditorOnDueReview);
      await storage.setItem(STORAGE_KEYS.badgeEnabled, mockSettings.badgeEnabled);
      await storage.setItem(STORAGE_KEYS.language, mockSettings.language);

      await setGistSyncConfig({ pat: 'private-pat' });
      await setGistSyncConfig({ gistId: 'exported-gist' });
      await setGistSyncConfig({ enabled: false });
      await storage.setItem(STORAGE_KEYS.lastSyncTime, 'private-sync-time');
      await storage.setItem(STORAGE_KEYS.dataUpdatedAt, '2024-01-01T00:00:00.000Z');

      const result = await exportData();
      const parsed = JSON.parse(result);

      expect(parsed.schemaVersion).toBe(5);
      expect(parsed.exportDate).toMatch(/^\d{4}-\d{2}-\d{2}T/);
      expect(parsed.data.stats).toEqual(mockStats);
      expect(parsed.data).not.toHaveProperty('notes');
      expect(parsed.data.settings).toEqual(mockSettings);
      expect(parsed.data.gistSync).toEqual({ gistId: 'exported-gist', enabled: false });
      expect(parsed.dataUpdatedAt).toBe('2024-01-01T00:00:00.000Z');
      expect(result).not.toContain('private-pat');
      expect(result).not.toContain('private-sync-time');

      expect(parsed.data.cards).toEqual(mockCards);
    });

    it('should handle empty data gracefully', async () => {
      await storage.setItem(STORAGE_KEYS.theme, 'invalid-theme');
      const result = await exportData();
      const parsed = JSON.parse(result);

      expect(parsed).toMatchObject({
        schemaVersion: 5,
        exportDate: expect.any(String),
        data: {
          cards: {},
          stats: {},
          settings: {},
        },
      });
      expect(parsed.data.monthlyStats).toBeUndefined();
    });

    it.each([undefined, 0, 1, 2, 3, 'unreadable'])(
      'labels exports with the supported schema regardless of device progress %s',
      async (progress) => {
        if (typeof progress === 'number') await setSchemaVersion(progress);
        const read = storage.getItem.bind(storage);
        vi.spyOn(storage, 'getItem').mockImplementation((key, options) => {
          if (progress === 'unreadable' && key === STORAGE_KEYS.schemaVersion) {
            throw new Error('Progress unavailable');
          }
          return read(key, options);
        });
        expect(JSON.parse(await exportData()).schemaVersion).toBe(5);
      }
    );

    it('does not export legacy monthly stats', async () => {
      await storage.setItem(legacyMonthlyStatsKey, { '2024-01': { totalReviews: 15 } });

      const parsed = JSON.parse(await exportData());

      expect(parsed.data.monthlyStats).toBeUndefined();
    });
  });

  describe('importData', () => {
    it.each(['cards', 'stats', 'notes'] as const)(
      'rejects mixed invalid %s during preparation and import without changing storage',
      async (collection) => {
        await setSchemaVersion(2);
        const { payload, accepted } = mixedRecordBackup();
        await importData(JSON.stringify({ ...payload, data: accepted }));
        await setGistSyncConfig({ pat: 'existing-pat' });
        await setGistSyncConfig({ gistId: 'existing-gist' });
        await storage.setItem(STORAGE_KEYS.lastSyncTime, payload.dataUpdatedAt);
        const before = await fakeBrowser.storage.local.get(null);
        const json = JSON.stringify({ ...payload, data: { ...accepted, [collection]: payload.data[collection] } });
        expect(() => parseBackup(json)).toThrow();
        await expect(importData(json)).rejects.toThrow();
        expect(await fakeBrowser.storage.local.get(null)).toEqual(before);
      }
    );

    it.each([0, undefined])('rejects invalid legacy schema %s records after migration', async (schemaVersion) => {
      await setSchemaVersion(2);
      const { payload, accepted } = mixedRecordBackup();
      await importData(JSON.stringify({ ...payload, data: accepted }));
      const before = await fakeBrowser.storage.local.get(null);
      const { domain: _domain, ...legacyCard } = accepted.cards['two-sum'];
      const json = JSON.stringify({
        ...payload,
        schemaVersion,
        data: { ...accepted, cards: { 'two-sum': { ...legacyCard, paused: 'false' } } },
      });
      await expect(importData(json)).rejects.toThrow();
      expect(await fakeBrowser.storage.local.get(null)).toEqual(before);
    });

    it.each(['slug', 'duplicate', 'date'] as const)(
      'rejects invalid %s relationships before replacement',
      async (kind) => {
        await setSchemaVersion(2);
        const { payload, accepted } = mixedRecordBackup();
        await importData(JSON.stringify({ ...payload, data: accepted }));
        const before = await fakeBrowser.storage.local.get(null);
        if (kind === 'slug') accepted.cards['two-sum'].slug = 'different';
        if (kind === 'duplicate') accepted.cards['cn-problem'].id = 'valid-com';
        if (kind === 'date') accepted.stats['2024-01-01'].date = '2024-01-02';
        await expect(importData(JSON.stringify({ ...payload, data: accepted }))).rejects.toThrow();
        expect(await fakeBrowser.storage.local.get(null)).toEqual(before);
      }
    );

    it.each([undefined, 0, 1705222800000])(
      'round-trips supported records with numeric dates and last_review %s',
      async (lastReview) => {
        await setSchemaVersion(2);
        const { payload, accepted, embedded } = mixedRecordBackup();
        const originalCard = accepted.cards['two-sum'];
        const data = {
          ...accepted,
          cards: {
            ...accepted.cards,
            'two-sum': {
              ...originalCard,
              createdAt: 0,
              fsrs: { ...originalCard.fsrs, due: 0, last_review: lastReview },
            },
          },
        };
        await importData(JSON.stringify({ ...payload, data }));
        const exported = await exportData();
        await resetAllData();
        await importData(exported);
        const restored = JSON.parse(await exportData());
        expect(restored.data.stats).toEqual(embedded.stats);
        expect(restored.data.cards['two-sum']).toEqual(
          JSON.parse(
            JSON.stringify({
              ...data.cards['two-sum'],
              note: 'Keep this note',
            })
          )
        );
        expect(restored.dataUpdatedAt).toBe(payload.dataUpdatedAt);
        expect(restored.schemaVersion).toBe(5);
      }
    );

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
          theme: 'light',
          resetEditorOnEveryProblem: true,
          resetEditorOnDueReview: true,
          badgeEnabled: false,
          language: 'en',
        }),
      },
    };

    const embeddedData = {
      cards: { 'two-sum': { ...validExportData.data.cards['two-sum'], note: 'Use hash map' } },
      stats: validExportData.data.stats,
      settings: validExportData.data.settings,
    };

    async function seedExistingData() {
      await storage.setItem(STORAGE_KEYS.cards, {
        old: createMockCard(State.New, { id: 'old', slug: 'old', note: 'old note' }),
      });
      await storage.setItem(STORAGE_KEYS.stats, { '2023-12-31': { totalReviews: 7 } });
      await setGistSyncConfig({ pat: 'existing-pat' });
      await setGistSyncConfig({ gistId: 'old-gist' });
      await storage.setItem(STORAGE_KEYS.dataUpdatedAt, '2023-12-31T00:00:00.000Z');
      await setSchemaVersion(2);
    }

    it.each([undefined, 0, 1, 2, 3, 'unreadable'])(
      'imports the supported schema independently of device progress %s without advancing it',
      async (progress) => {
        await seedExistingData();
        await storage.removeItem(STORAGE_KEYS.schemaVersion);
        if (typeof progress === 'number') await setSchemaVersion(progress);
        const read = storage.getItem.bind(storage);
        vi.spyOn(storage, 'getItem').mockImplementation((key, options) => {
          if (progress === 'unreadable' && key === STORAGE_KEYS.schemaVersion) {
            throw new Error('Progress unavailable');
          }
          return read(key, options);
        });
        const json = JSON.stringify({ ...validExportData, schemaVersion: 3 });
        const before = await fakeBrowser.storage.local.get(null);
        const syncBefore = await fakeBrowser.storage.sync.get(null);

        expect(parseBackup(json).cards).toEqual(embeddedData.cards);
        expect(await fakeBrowser.storage.local.get(null)).toEqual(before);
        expect(await fakeBrowser.storage.sync.get(null)).toEqual(syncBefore);
        await importData(json);
        expect(JSON.parse(await exportData()).data).toMatchObject(JSON.parse(JSON.stringify(embeddedData)));
        expect(await read(STORAGE_KEYS.schemaVersion)).toBe(typeof progress === 'number' ? progress : null);
      }
    );

    it.each(['2024-01-01T00:00:00.000Z', '2024-01-01T05:30:00+05:30', '2024-01-01', 'Mon, 01 Jan 2024 00:00:00 GMT'])(
      'accepts and preserves the timestamp format %s',
      async (timestamp) => {
        await importData(JSON.stringify({ ...validExportData, exportDate: timestamp, dataUpdatedAt: timestamp }));
        expect(await storage.getItem(STORAGE_KEYS.dataUpdatedAt)).toBe(timestamp);
        expect(JSON.parse(await exportData()).dataUpdatedAt).toBe(timestamp);
      }
    );

    it.each([undefined, {}, { enabled: false }, { gistId: 'incoming-gist' }])(
      'imports omitted settings and optional Gist fields: %j',
      async (gistSync) => {
        await seedExistingData();
        await storage.setItem(STORAGE_KEYS.theme, 'light');
        await storage.setItem(STORAGE_KEYS.maxNewCardsPerDay, 12);
        await setGistSyncConfig({ enabled: true });
        const writes = vi.spyOn(fakeBrowser.storage.sync, 'set');
        await importData(
          JSON.stringify({ ...validExportData, data: { ...validExportData.data, settings: undefined, gistSync } })
        );
        expect(writes).toHaveBeenCalledExactlyOnceWith({
          'leetsrs:gistConnection': {
            pat: 'existing-pat',
            gistId: gistSync?.gistId ?? null,
            enabled: gistSync?.enabled ?? false,
          },
        });
        expect(await storage.getItem(STORAGE_KEYS.theme)).toBeNull();
        expect(await storage.getItem(STORAGE_KEYS.maxNewCardsPerDay)).toBeNull();
        expect((await readGistConnection()).gistId).toBe(gistSync?.gistId ?? null);
        expect((await readGistConnection()).enabled).toBe(gistSync?.enabled ?? false);
        expect((await readGistConnection()).pat).toBe('existing-pat');
        expect(await storage.getItem(STORAGE_KEYS.cards)).toEqual(embeddedData.cards);
      }
    );

    it('replaces supported fields, strips unknown fields, and preserves the local PAT and schema', async () => {
      await seedExistingData();
      await storage.setItem(STORAGE_KEYS.theme, 'dark');
      await storage.setItem(STORAGE_KEYS.maxNewCardsPerDay, 12);

      const card = validExportData.data.cards['two-sum'];
      const stats = validExportData.data.stats['2024-01-01'];
      await importData(
        JSON.stringify({
          ...validExportData,
          dataUpdatedAt: '2024-01-01T00:00:00.000Z',
          extra: true,
          data: {
            ...validExportData.data,
            extra: true,
            cards: { 'two-sum': { ...card, extra: true, fsrs: { ...card.fsrs, extra: true } } },
            stats: {
              '2024-01-01': { ...stats, extra: true, gradeBreakdown: { ...stats.gradeBreakdown, extra: true } },
            },
            notes: { [cardUuid]: { ...validExportData.data.notes[cardUuid], extra: true } },
            settings: { ...validExportData.data.settings, extra: true },
            gistSync: { gistId: 'incoming-gist', enabled: false, pat: 'untrusted-pat', extra: true },
          },
        })
      );

      expect(await storage.getItem(STORAGE_KEYS.cards)).toEqual(embeddedData.cards);
      expect(await storage.getItem(STORAGE_KEYS.stats)).toEqual(validExportData.data.stats);
      expect(JSON.parse(await exportData()).data).not.toHaveProperty('notes');
      expect(await storage.getItem(`local:leetsrs:notes:old`)).toBeNull();
      expect(await storage.getItem(STORAGE_KEYS.theme)).toBe(validExportData.data.settings.theme);
      expect(await storage.getItem(STORAGE_KEYS.maxNewCardsPerDay)).toBe(
        validExportData.data.settings.maxNewCardsPerDay
      );
      expect(await storage.getItem(STORAGE_KEYS.dataUpdatedAt)).toBe('2024-01-01T00:00:00.000Z');
      expect((await readGistConnection()).pat).toBe('existing-pat');
      expect(await storage.getItem(STORAGE_KEYS.schemaVersion)).toBe(2);
      expect(JSON.parse(await exportData()).data).toEqual({
        ...embeddedData,
        gistSync: { gistId: 'incoming-gist', enabled: false },
      });
    });

    it('reports a failure to remove the previous dataset', async () => {
      await seedExistingData();
      const failure = new Error('reset failed');
      const remove = storage.removeItem.bind(storage);
      vi.spyOn(storage, 'removeItem').mockImplementation((key, options) =>
        key === STORAGE_KEYS.cards ? Promise.reject(failure) : remove(key, options)
      );

      await expect(importData(JSON.stringify(validExportData))).rejects.toBe(failure);
    });

    it.each([STORAGE_KEYS.cards, STORAGE_KEYS.stats, STORAGE_KEYS.theme, STORAGE_KEYS.dataUpdatedAt])(
      'reports a failed import write to %s',
      async (failedKey) => {
        await seedExistingData();
        const failure = new Error('import write failed');
        const write = storage.setItem.bind(storage);
        vi.spyOn(storage, 'setItem').mockImplementation((key, value) =>
          key === failedKey ? Promise.reject(failure) : write(key, value)
        );

        await expect(importData(JSON.stringify(validExportData))).rejects.toBe(failure);
      }
    );

    it.each([null, 'existing-pat'])('ignores imported credentials when the local PAT is %s', async (pat) => {
      if (pat !== null) await setGistSyncConfig({ pat: pat });
      await importData(
        JSON.stringify({
          ...validExportData,
          data: { ...validExportData.data, gistSync: { pat: 'untrusted-pat', githubPat: 'untrusted-legacy-pat' } },
        })
      );
      expect((await readGistConnection()).pat).toBe(pat || '');
    });

    describe('schema migrations', () => {
      const { domain: _domain, ...legacyCard } = validExportData.data.cards['two-sum'];
      const legacyCards = {
        'two-sum': {
          ...legacyCard,
          paused: true,
          fsrs: { ...legacyCard.fsrs, last_review: 1704067200000, scheduled_days: 7, reps: 4 },
        },
        'add-two-numbers': {
          ...legacyCard,
          id: 'cn-card-id',
          slug: 'add-two-numbers',
          name: 'Add Two Numbers',
          leetcodeId: '2',
          domain: 'leetcode.cn',
        },
      };
      const currentCards = {
        ...legacyCards,
        'two-sum': { ...legacyCards['two-sum'], domain: 'leetcode.com' },
      };
      const notes = { ...validExportData.data.notes, 'cn-card-id': { text: 'Keep the carry' } };
      const embeddedCards = {
        'two-sum': { ...currentCards['two-sum'], note: 'Use hash map' },
        'add-two-numbers': { ...currentCards['add-two-numbers'], note: 'Keep the carry' },
      };
      const dataUpdatedAt = '2024-01-15T10:00:00.000Z';

      it.each([0, undefined, 1, 2, 3])(
        'prepares and imports schema %s cards identically to startup migration',
        async (schemaVersion) => {
          if (schemaVersion !== undefined) await setSchemaVersion(schemaVersion);
          await storage.setItem(STORAGE_KEYS.cards, schemaVersion ? currentCards : legacyCards);
          await storage.setItem(STORAGE_KEYS.stats, validExportData.data.stats);
          for (const [id, note] of Object.entries(notes)) {
            await storage.setItem(`local:leetsrs:notes:${id}`, note);
          }
          for (const [key, value] of Object.entries(validExportData.data.settings)) {
            await storage.setItem(STORAGE_KEYS[key as keyof typeof validExportData.data.settings], value);
          }
          if (schemaVersion !== 3) await storage.setItem('sync:leetsrs:dayStartHour', 4);
          await setGistSyncConfig({ pat: 'existing-pat' });
          await runStartupMigrations();
          const startupCards = await storage.getItem(STORAGE_KEYS.cards);
          expect(startupCards).toEqual(embeddedCards);
          const startupData = JSON.parse(await exportData()).data;
          await setSchemaVersion(0);
          await storage.setItem('sync:leetsrs:dayStartHour', 9);
          const syncBefore = await fakeBrowser.storage.sync.get(null);
          const before = await fakeBrowser.storage.local.get(null);
          const json = JSON.stringify({
            ...validExportData,
            schemaVersion,
            dataUpdatedAt,
            data: {
              ...validExportData.data,
              cards: schemaVersion ? currentCards : legacyCards,
              settings: { ...validExportData.data.settings, ...(schemaVersion !== 3 && { dayStartHour: 4 }) },
              notes,
            },
          });

          const prepared = parseBackup(json);

          expect.soft(prepared.cards).toEqual(startupCards);
          expect(prepared).not.toHaveProperty('notes');
          expect(prepared.stats).toEqual(validExportData.data.stats);
          expect(prepared.settings).toEqual(validExportData.data.settings);
          expect(prepared.dataUpdatedAt).toBe(dataUpdatedAt);
          expect(await fakeBrowser.storage.local.get(null)).toEqual(before);
          expect(await fakeBrowser.storage.sync.get(null)).toEqual(syncBefore);

          await importData(json);

          expect.soft(await storage.getItem(STORAGE_KEYS.cards)).toEqual(startupCards);
          expect(await storage.getItem(STORAGE_KEYS.stats)).toEqual(validExportData.data.stats);
          for (const id of Object.keys(notes)) {
            expect(await storage.getItem(`local:leetsrs:notes:${id}`)).toBeNull();
          }
          expect(await storage.getItem(STORAGE_KEYS.theme)).toBe('light');
          expect((await readGistConnection()).pat).toBe('existing-pat');
          expect(await storage.getItem(STORAGE_KEYS.dataUpdatedAt)).toBe(dataUpdatedAt);
          expect(await storage.getItem(STORAGE_KEYS.schemaVersion)).toBe(0);
          expect(await storage.getItem('sync:leetsrs:dayStartHour')).toBe(9);
          expect(JSON.parse(await exportData()).data).toEqual(startupData);
        }
      );

      it.each([undefined, 0, 1, 2])(
        'passes raw schema %s fields to their transformation without storage access',
        async (schemaVersion) => {
          const rawData = {
            ...validExportData.data,
            cards: schemaVersion ? currentCards : legacyCards,
            notes,
            settings: {
              ...validExportData.data.settings,
              dayStartHour: { historical: 'retain until migration' },
              autoClearLeetcode: true,
              historicalSetting: { nested: [1, 2] },
            },
            historicalRoot: { keep: true },
          };
          // Observe the real historical transformation: final normalization alone
          // cannot prove that retired fields reached the migration intact.
          const transform = vi.spyOn(removeDayStart, 'migrate');
          for (const area of ['local', 'sync'] as const) {
            for (const operation of ['get', 'set', 'remove', 'clear'] as const) {
              vi.spyOn(fakeBrowser.storage[area], operation).mockImplementation(() => {
                throw new Error('Preparation must not access storage');
              });
            }
          }

          const prepared = parseBackup(
            JSON.stringify({ ...validExportData, schemaVersion, dataUpdatedAt, data: rawData })
          );

          expect(transform).toHaveBeenCalledWith({ ...rawData, cards: currentCards });
          expect(prepared).toEqual({
            cards: embeddedCards,
            stats: validExportData.data.stats,
            settings: validExportData.data.settings,
            gistSync: undefined,
            dataUpdatedAt,
          });
        }
      );

      it.each([1, 2, 3])(
        'rejects schema %s cards missing their required domain without repair',
        async (schemaVersion) => {
          await seedExistingData();
          const before = await fakeBrowser.storage.local.get(null);
          const syncBefore = await fakeBrowser.storage.sync.get(null);
          const json = JSON.stringify({
            ...validExportData,
            schemaVersion,
            data: { ...validExportData.data, cards: legacyCards, notes },
          });

          expect(() => parseBackup(json)).toThrow();
          await expect(importData(json)).rejects.toThrow();
          expect(await fakeBrowser.storage.local.get(null)).toEqual(before);
          expect(await fakeBrowser.storage.sync.get(null)).toEqual(syncBefore);
        }
      );

      it('leaves storage untouched when preparing a legacy import fails', async () => {
        await setSchemaVersion(2);
        await storage.setItem(STORAGE_KEYS.cards, currentCards);
        await storage.setItem(STORAGE_KEYS.stats, validExportData.data.stats);
        for (const [id, note] of Object.entries(notes)) {
          await storage.setItem(`local:leetsrs:notes:${id}`, note);
        }
        await storage.setItem(STORAGE_KEYS.theme, 'dark');
        await setGistSyncConfig({ pat: 'existing-pat' });
        await setGistSyncConfig({ gistId: 'existing-gist' });
        await setGistSyncConfig({ enabled: true });
        await storage.setItem(STORAGE_KEYS.lastSyncTime, dataUpdatedAt);
        await storage.setItem(STORAGE_KEYS.lastSyncDirection, 'push');
        await storage.setItem(STORAGE_KEYS.dataUpdatedAt, dataUpdatedAt);
        const before = await fakeBrowser.storage.local.get(null);
        const json = JSON.stringify({
          ...validExportData,
          data: { ...validExportData.data, cards: legacyCards, notes, settings: { theme: 'invalid' } },
        });

        expect(() => parseBackup(json)).toThrow('Theme must be');
        expect(await fakeBrowser.storage.local.get(null)).toEqual(before);
        await expect(importData(json)).rejects.toThrow('Theme must be');
        expect(await fakeBrowser.storage.local.get(null)).toEqual(before);
      });
    });

    it('rejects notes over 500 characters before replacing any local data', async () => {
      await storage.setItem(STORAGE_KEYS.theme, 'dark');
      await storage.setItem(`local:leetsrs:notes:${cardUuid}`, { text: 'existing note' });
      const before = await fakeBrowser.storage.local.get(null);
      const json = JSON.stringify({
        ...validExportData,
        data: { ...validExportData.data, notes: { [cardUuid]: { text: 'a'.repeat(501) } } },
      });
      expect(() => parseBackup(json)).toThrow('Note exceeds maximum length of 500 characters');
      await expect(importData(json)).rejects.toThrow('Note exceeds maximum length of 500 characters');
      expect(await fakeBrowser.storage.local.get(null)).toEqual(before);
    });

    it.each([
      ...malformedBackupCases(validExportData),
      ...['dayStartHour', 'autoClearLeetcode'].map((key) => [
        `retired ${key} in the declared latest version`,
        JSON.stringify({
          ...validExportData,
          schemaVersion: 3,
          data: { ...validExportData.data, settings: { resetEditorOnEveryProblem: false, [key]: true } },
        }),
      ]),
      ['future schema version', JSON.stringify({ ...validExportData, schemaVersion: 6 })],
      ['null root', 'null'],
      ['missing export date', JSON.stringify({ data: {} })],
      ...['cards', 'stats', 'notes'].map((key) => [
        `null ${key}`,
        JSON.stringify({ ...validExportData, data: { ...validExportData.data, [key]: null } }),
      ]),
    ])('rejects %s during preparation and import without changing storage', async (_name, json) => {
      await setSchemaVersion(2);
      await storage.setItem(STORAGE_KEYS.cards, validExportData.data.cards);
      await storage.setItem(STORAGE_KEYS.stats, validExportData.data.stats);
      await storage.setItem(`local:leetsrs:notes:${cardUuid}`, { text: 'existing note' });
      for (const [key, value] of Object.entries(validExportData.data.settings)) {
        await storage.setItem(STORAGE_KEYS[key as keyof typeof validExportData.data.settings], value);
      }
      await setGistSyncConfig({ pat: 'existing-pat' });
      await setGistSyncConfig({ gistId: 'existing-gist' });
      await setGistSyncConfig({ enabled: true });
      await storage.setItem(STORAGE_KEYS.lastSyncTime, '2024-02-01T00:00:00.000Z');
      await storage.setItem(STORAGE_KEYS.lastSyncDirection, 'push');
      await storage.setItem(STORAGE_KEYS.dataUpdatedAt, '2024-02-02T00:00:00.000Z');
      const before = await fakeBrowser.storage.local.get(null);

      expect.soft(() => parseBackup(json)).toThrow();
      expect.soft(await fakeBrowser.storage.local.get(null)).toEqual(before);
      await expect.soft(importData(json)).rejects.toThrow();
      expect(await fakeBrowser.storage.local.get(null)).toEqual(before);
    });

    describe('legacy imports', () => {
      it('prepares legacy settings without writes and imports normalized values', async () => {
        const existingCards = { existing: createMockCard(State.New, { slug: 'existing' }) };
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
        const preparedData = parseBackup(serializedLegacyData);

        expect(preparedData).toMatchObject({
          cards: JSON.parse(JSON.stringify(embeddedData.cards)),
          stats: parsedLegacyData.data.stats,
          settings: { ...legacySettings, resetEditorOnEveryProblem: true },
          dataUpdatedAt: '2024-01-15T10:00:00.000Z',
        });
        expect(preparedData.settings).not.toHaveProperty('animationsEnabled');
        expect(preparedData.settings).not.toHaveProperty('autoClearLeetcode');
        expect(await storage.getItem(STORAGE_KEYS.cards)).toEqual(existingCards);
        await importData(serializedLegacyData);
        expect(JSON.parse(await exportData()).data.settings).toEqual({
          ...legacySettings,
          resetEditorOnEveryProblem: true,
        });
      });
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

    it('uses the export timestamp when the import omits dataUpdatedAt', async () => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date('2026-09-06T12:00:00.000Z'));
      await importData(JSON.stringify(validExportData));

      expect(await storage.getItem(STORAGE_KEYS.dataUpdatedAt)).toBe(validExportData.exportDate);
    });

    it('should throw error for invalid JSON', async () => {
      await expect(importData('invalid json')).rejects.toThrow('Invalid JSON format');
    });

    it('should throw error for newer schema version', async () => {
      const newerSchema = { ...validExportData, schemaVersion: 999 };
      await expect(importData(JSON.stringify(newerSchema))).rejects.toThrow(
        'Export is from a newer version (schema 999). Please update the extension.'
      );
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
      await storage.setItem(STORAGE_KEYS.cards, {
        'existing-card': createMockCard(State.New, { slug: 'existing-card' }),
      });
      await storage.setItem(STORAGE_KEYS.stats, { '2024-01-01': {} });

      const emptyData = {
        ...validExportData,
        data: {
          cards: {},
          stats: {},
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
        'two-sum': createMockCard(State.New, { id: uuid1, slug: 'two-sum', note: 'note 1' }),
        'three-sum': createMockCard(State.New, { id: uuid2, slug: 'three-sum', note: 'note 2' }),
      };
      await storage.setItem(STORAGE_KEYS.cards, mockCards);
      await storage.setItem(STORAGE_KEYS.stats, { '2024-01-01': {} });
      const legacyMonthlyStats = { '2023-12': { totalReviews: 5 } };
      await storage.setItem(legacyMonthlyStatsKey, legacyMonthlyStats);
      await storage.setItem(STORAGE_KEYS.maxNewCardsPerDay, 5);
      await storage.setItem(STORAGE_KEYS.theme, 'dark');
      await storage.setItem(STORAGE_KEYS.resetEditorOnEveryProblem, true);
      await storage.setItem(STORAGE_KEYS.resetEditorOnDueReview, true);
      await storage.setItem(STORAGE_KEYS.badgeEnabled, true);
      await storage.setItem(STORAGE_KEYS.language, 'en');

      await setGistSyncConfig({ pat: 'existing-pat', gistId: 'gist', enabled: true });
      await fakeBrowser.storage.sync.set({
        'leetsrs:githubPat': 'old',
        'leetsrs:gistId': 'old-gist',
        'leetsrs:gistSyncEnabled': true,
      });
      await storage.setItem(STORAGE_KEYS.dataUpdatedAt, '2024-01-01T00:00:00.000Z');
      await setSchemaVersion(2);

      const remove = vi.spyOn(fakeBrowser.storage.sync, 'remove');
      await resetAllData();
      expect(await fakeBrowser.storage.sync.get(null)).toEqual({});
      expect(remove).toHaveBeenCalledWith([
        'leetsrs:gistConnection',
        'leetsrs:githubPat',
        'leetsrs:gistId',
        'leetsrs:gistSyncEnabled',
      ]);

      expect((await readGistConnection()).pat).toBe('');
      expect(await storage.getItem(STORAGE_KEYS.dataUpdatedAt)).toBeNull();
      expect(await storage.getItem(STORAGE_KEYS.schemaVersion)).toBe(2);

      // Verify all data was removed
      expect(await storage.getItem(STORAGE_KEYS.cards)).toBeNull();
      expect(await storage.getItem(STORAGE_KEYS.stats)).toBeNull();
      expect(await storage.getItem(legacyMonthlyStatsKey)).toEqual(legacyMonthlyStats);
      expect(await storage.getItem(STORAGE_KEYS.maxNewCardsPerDay)).toBeNull();
      expect(await storage.getItem(STORAGE_KEYS.theme)).toBeNull();
      expect(await storage.getItem(STORAGE_KEYS.resetEditorOnEveryProblem)).toBeNull();
      expect(await storage.getItem(STORAGE_KEYS.resetEditorOnDueReview)).toBeNull();
      expect(await storage.getItem(STORAGE_KEYS.badgeEnabled)).toBeNull();
      expect(await storage.getItem(STORAGE_KEYS.language)).toBeNull();
      expect(await storage.getItem(`local:leetsrs:notes:${uuid1}` as const)).toBeNull();
      expect(await storage.getItem(`local:leetsrs:notes:${uuid2}` as const)).toBeNull();
    });
  });
});

// Prepared workflows move to registered commands at activation in #378.
describe('document import-export', () => {
  const timestamp = '2024-01-15T10:00:00.000Z';
  const connection = { pat: 'private-pat', gistId: 'local-gist', enabled: true };

  beforeEach(async () => {
    fakeBrowser.reset();
    const get = fakeBrowser.storage.local.get.bind(fakeBrowser.storage.local);
    vi.spyOn(fakeBrowser.storage.local, 'get').mockImplementation(async (keys) => structuredClone(await get(keys)));
    await setGistSyncConfig(connection);
    await storage.setItem(STORAGE_KEYS.lastSyncTime, 'previous-sync');
    await storage.setItem(STORAGE_KEYS.lastSyncDirection, 'pull');
  });

  it('round-trips the complete captured document without connection or status fields', async () => {
    const { embedded } = mixedRecordBackup();
    const document: LearningDocument = {
      schemaVersion: LEARNING_DOCUMENT_VERSION,
      ...embedded,
      settings: { theme: 'dark', maxNewCardsPerDay: 7 },
      dataUpdatedAt: timestamp,
    };
    await replaceLearningDocument(document);
    // Stale scattered keys must not become part of the exported snapshot.
    await storage.setItem(STORAGE_KEYS.theme, 'light');
    const reads = vi.spyOn(storage, 'getItem');
    const json = await documentBackup.exportData();
    expect(reads.mock.calls.map(([key]) => key)).toEqual([STORAGE_KEYS.learningDocument]);
    expect(JSON.parse(json)).toEqual(document);

    await documentBackup.importData(JSON.stringify({ ...document, cards: {}, settings: {} }));
    await documentBackup.importData(json);
    expect(await readLearningDocument()).toEqual(document);
    expect(await readGistConnection()).toEqual(connection);
    expect(await storage.getItem(STORAGE_KEYS.lastSyncTime)).toBe('previous-sync');
    expect(await storage.getItem(STORAGE_KEYS.lastSyncDirection)).toBe('pull');
  });

  it.each([undefined, 0, 1, 2, 3, 4, 5])(
    'round-trips historical version %s with stored settings and the export-time fallback',
    async (schemaVersion) => {
      const { accepted, embedded } = mixedRecordBackup();
      const settings =
        schemaVersion === undefined || schemaVersion < 3
          ? { autoClearLeetcode: false, dayStartHour: 4, theme: 'dark' }
          : { resetEditorOnEveryProblem: false, theme: 'dark' };
      const data = schemaVersion !== undefined && schemaVersion >= 4 ? embedded : accepted;
      await documentBackup.importData(
        JSON.stringify({
          schemaVersion,
          exportDate: timestamp,
          data: { ...data, settings, gistSync: { gistId: 'incoming', enabled: false, pat: 'incoming-pat' } },
        })
      );
      const expected = {
        schemaVersion: LEARNING_DOCUMENT_VERSION,
        ...embedded,
        settings: { resetEditorOnEveryProblem: false, theme: 'dark' },
        dataUpdatedAt: timestamp,
      };
      expect(JSON.parse(await documentBackup.exportData())).toEqual(expected);
      await documentBackup.importData(await documentBackup.exportData());
      expect(await readLearningDocument()).toEqual(expected);
      expect(await readGistConnection()).toEqual(connection);
      expect(await storage.getItem(STORAGE_KEYS.lastSyncTime)).toBe('previous-sync');
    }
  );

  it.each(['current', 'historical'])(
    'replaces omitted notes and settings from a %s backup in one write',
    async (format) => {
      const card = createMockCard(State.New, { slug: 'two-sum' });
      await replaceLearningDocument({
        schemaVersion: LEARNING_DOCUMENT_VERSION,
        cards: { 'two-sum': { ...card, note: 'old note' } },
        stats: {},
        settings: { theme: 'dark', language: 'zh-CN' },
        dataUpdatedAt: timestamp,
      });
      const data = { cards: { 'two-sum': card }, stats: {} };
      const input =
        format === 'current'
          ? { schemaVersion: LEARNING_DOCUMENT_VERSION, ...data, settings: {} }
          : { schemaVersion: 5, exportDate: timestamp, dataUpdatedAt: '2023-01-01', data };
      const writes = vi.spyOn(storage, 'setItem');
      await documentBackup.importData(JSON.stringify(input));
      const expected = {
        schemaVersion: LEARNING_DOCUMENT_VERSION,
        ...data,
        settings: {},
        ...(format === 'historical' && { dataUpdatedAt: '2023-01-01' }),
      };
      expect(writes).toHaveBeenCalledExactlyOnceWith(STORAGE_KEYS.learningDocument, expected);
      expect(JSON.parse(await documentBackup.exportData())).toEqual(expected);
      expect(await readGistConnection()).toEqual(connection);
      expect(await storage.getItem(STORAGE_KEYS.lastSyncTime)).toBe('previous-sync');
      expect(await storage.getItem(STORAGE_KEYS.lastSyncDirection)).toBe('pull');
    }
  );

  it.each(['preparation', 'replacement'])(
    'leaves the saved document and connection intact after failed %s and permits retry',
    async (stage) => {
      const before: LearningDocument = {
        schemaVersion: LEARNING_DOCUMENT_VERSION,
        cards: {},
        stats: {},
        settings: { theme: 'dark' },
        dataUpdatedAt: timestamp,
      };
      await replaceLearningDocument(before);
      const next = { ...before, settings: { theme: 'light' } };
      const writes = vi.spyOn(storage, 'setItem');
      if (stage === 'replacement') {
        writes.mockRejectedValueOnce(new Error('write failed'));
      }
      const input = stage === 'preparation' ? { ...next, cards: { invalid: {} } } : next;
      await expect(documentBackup.importData(JSON.stringify(input))).rejects.toThrow();
      expect(await readLearningDocument()).toEqual(before);
      expect(await readGistConnection()).toEqual(connection);
      expect(await storage.getItem(STORAGE_KEYS.lastSyncTime)).toBe('previous-sync');
      if (stage === 'preparation') {
        expect(writes).not.toHaveBeenCalled();
      }
      await documentBackup.importData(JSON.stringify(next));
      expect(JSON.parse(await documentBackup.exportData())).toEqual(next);
    }
  );

  it('rejects export before initialization without manufacturing a timestamp or document', async () => {
    await expect(documentBackup.exportData()).rejects.toThrow('Learning document is not initialized');
    expect(await readLearningDocument()).toBeUndefined();
  });
});
