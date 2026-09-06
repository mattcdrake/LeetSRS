import { Rating } from 'ts-fsrs';
import { beforeEach, describe, expect, it } from 'vitest';
import { fakeBrowser } from 'wxt/testing/fake-browser';
import { storage } from 'wxt/utils/storage';
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
});
