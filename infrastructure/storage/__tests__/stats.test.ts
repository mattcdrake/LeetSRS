import { Rating } from 'ts-fsrs';
import { beforeEach, describe, expect, it } from 'vitest';
import { fakeBrowser } from 'wxt/testing/fake-browser';
import { storage } from 'wxt/utils/storage';
import { ZodError } from 'zod';
import { createDailyStats } from '@/domain/statistics';
import { getStats, getStatsForDate, saveStats } from '../stats';
import { STORAGE_KEYS } from '../storage-keys';

describe('Stat persistence', () => {
  beforeEach(() => fakeBrowser.reset());

  it('should return null when no stats exist for date', async () => {
    const stats = await getStatsForDate('2024-03-15');
    expect(stats).toBeNull();
  });

  it('defaults an absent record to empty and writes the supplied dates without merging', async () => {
    expect(await getStats()).toEqual({});
    const first = createDailyStats('2024-03-14', undefined);
    const second = createDailyStats('2024-03-15', first);
    second.gradeBreakdown[Rating.Good] = 2;
    await storage.setItem(STORAGE_KEYS.stats, { [first.date]: first });

    await saveStats({ [second.date]: second });

    expect(await storage.getItem(STORAGE_KEYS.stats)).toEqual({ [second.date]: second });
    expect(await getStats()).toEqual({ [second.date]: second });
    expect(await getStatsForDate(first.date)).toBeNull();
    expect(await getStatsForDate(second.date)).toEqual(second);
    expect(await storage.getItem(STORAGE_KEYS.dataUpdatedAt)).toBeNull();
  });

  it.each([[], false, 'stats', { invalid: null }, { invalid: {} }])(
    'rejects malformed stored stats %j',
    async (value) => {
      await storage.setItem(STORAGE_KEYS.stats, value);
      await expect(getStats()).rejects.toBeInstanceOf(ZodError);
    }
  );

  it.each([
    { date: '2024-02-30' },
    { totalReviews: -1 },
    { newCards: 0.5 },
    { reviewedCards: '1' },
    { streak: null },
    { gradeBreakdown: { 1: -1 } },
    { gradeBreakdown: { 2: 0.5 } },
    { gradeBreakdown: { 3: null } },
  ])('rejects malformed stats fields without changing storage: %j', async (overrides) => {
    const stats = createDailyStats('2024-03-15', undefined);
    const records = {
      [stats.date]: {
        ...stats,
        ...overrides,
        gradeBreakdown: { ...stats.gradeBreakdown, ...overrides.gradeBreakdown },
      },
    };
    await storage.setItem(STORAGE_KEYS.stats, records);
    await expect(getStatsForDate(stats.date)).rejects.toBeInstanceOf(ZodError);
    expect(await storage.getItem(STORAGE_KEYS.stats)).toEqual(records);
  });

  it('strips unknown stats and grade fields without rewriting storage', async () => {
    const stats = createDailyStats('2024-02-29', undefined);
    const records = {
      [stats.date]: { ...stats, extra: true, gradeBreakdown: { ...stats.gradeBreakdown, extra: true } },
    };
    await storage.setItem(STORAGE_KEYS.stats, records);
    expect(await getStats()).toEqual({ [stats.date]: stats });
    expect(await getStatsForDate(stats.date)).toEqual(stats);
    expect(await storage.getItem(STORAGE_KEYS.stats)).toEqual(records);
  });
});
