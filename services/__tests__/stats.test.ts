import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { fakeBrowser } from 'wxt/testing';
import { storage } from 'wxt/utils/storage';
import {
  getTodayKey,
  getYesterdayKey,
  updateStats,
  getStatsForDate,
  getTodayStats,
  getAllStats,
  type DailyStats,
} from '../stats';
import { Rating } from 'ts-fsrs';
import { STORAGE_KEYS } from '../storage-keys';

describe('Date key generation', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('getTodayKey', () => {
    it('should return date in YYYY-MM-DD format', () => {
      vi.setSystemTime(new Date('2024-03-15T10:30:00'));
      expect(getTodayKey()).toBe('2024-03-15');
    });

    it('should pad single digit months and days', () => {
      vi.setSystemTime(new Date('2024-01-05T10:30:00'));
      expect(getTodayKey()).toBe('2024-01-05');
    });

    it('should handle December correctly', () => {
      vi.setSystemTime(new Date('2024-12-25T10:30:00'));
      expect(getTodayKey()).toBe('2024-12-25');
    });

    it('should handle end of month', () => {
      vi.setSystemTime(new Date('2024-01-31T23:59:59'));
      expect(getTodayKey()).toBe('2024-01-31');
    });

    it('should handle leap year date', () => {
      vi.setSystemTime(new Date('2024-02-29T10:00:00'));
      expect(getTodayKey()).toBe('2024-02-29');
    });

    it('should use local timezone', () => {
      const date = new Date('2024-03-15T10:30:00');
      vi.setSystemTime(date);
      const key = getTodayKey();
      expect(key).toBe('2024-03-15');
    });
  });

  describe('getYesterdayKey', () => {
    it('should return yesterday date in YYYY-MM-DD format', () => {
      vi.setSystemTime(new Date('2024-03-15T10:30:00'));
      expect(getYesterdayKey()).toBe('2024-03-14');
    });

    it('should handle month boundary correctly', () => {
      vi.setSystemTime(new Date('2024-03-01T10:30:00'));
      expect(getYesterdayKey()).toBe('2024-02-29'); // 2024 is leap year
    });

    it('should handle month boundary in non-leap year', () => {
      vi.setSystemTime(new Date('2023-03-01T10:30:00'));
      expect(getYesterdayKey()).toBe('2023-02-28');
    });

    it('should handle year boundary correctly', () => {
      vi.setSystemTime(new Date('2024-01-01T00:00:00'));
      expect(getYesterdayKey()).toBe('2023-12-31');
    });

    it('should handle different month lengths', () => {
      // May has 31 days
      vi.setSystemTime(new Date('2024-06-01T10:00:00'));
      expect(getYesterdayKey()).toBe('2024-05-31');

      // April has 30 days
      vi.setSystemTime(new Date('2024-05-01T10:00:00'));
      expect(getYesterdayKey()).toBe('2024-04-30');
    });

    it('should pad single digit months and days', () => {
      vi.setSystemTime(new Date('2024-10-01T10:30:00'));
      expect(getYesterdayKey()).toBe('2024-09-30');

      vi.setSystemTime(new Date('2024-01-10T10:30:00'));
      expect(getYesterdayKey()).toBe('2024-01-09');
    });

    it('should handle leap year Feb 29 to Mar 1', () => {
      vi.setSystemTime(new Date('2024-02-29T10:00:00'));
      expect(getYesterdayKey()).toBe('2024-02-28');

      vi.setSystemTime(new Date('2024-03-01T10:00:00'));
      expect(getYesterdayKey()).toBe('2024-02-29');
    });

    it('should handle DST transitions', () => {
      // Test spring forward (typically March)
      vi.setSystemTime(new Date('2024-03-11T10:00:00')); // Day after DST in US
      expect(getYesterdayKey()).toBe('2024-03-10');

      // Test fall back (typically November)
      vi.setSystemTime(new Date('2024-11-04T10:00:00')); // Day after DST ends in US
      expect(getYesterdayKey()).toBe('2024-11-03');
    });
  });

  describe('getTodayKey and getYesterdayKey consistency', () => {
    it('should have yesterday be one day before today', () => {
      const testDates = [
        '2024-03-15T10:30:00',
        '2024-01-01T00:00:00',
        '2024-02-29T23:59:59',
        '2024-12-31T12:00:00',
        '2024-07-01T06:00:00',
      ];

      testDates.forEach((dateStr) => {
        vi.setSystemTime(new Date(dateStr));
        const today = getTodayKey();

        // Move to next day
        const tomorrow = new Date(dateStr);
        tomorrow.setDate(tomorrow.getDate() + 1);
        vi.setSystemTime(tomorrow);

        const yesterday = getYesterdayKey();
        expect(yesterday).toBe(today);
      });
    });
  });
});

describe('Stats management', () => {
  beforeEach(() => {
    fakeBrowser.reset();
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2024-03-15T10:00:00'));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('updateStats', () => {
    it('should create new stats for first review of the day', async () => {
      await updateStats(Rating.Good, false);

      const stats = await storage.getItem<Record<string, DailyStats>>(STORAGE_KEYS.stats);
      const todayStats = stats?.['2024-03-15'];

      expect(todayStats).toBeDefined();
      expect(todayStats?.date).toBe('2024-03-15');
      expect(todayStats?.totalReviews).toBe(1);
      expect(todayStats?.gradeBreakdown[Rating.Good]).toBe(1);
      expect(todayStats?.gradeBreakdown[Rating.Again]).toBe(0);
      expect(todayStats?.gradeBreakdown[Rating.Hard]).toBe(0);
      expect(todayStats?.gradeBreakdown[Rating.Easy]).toBe(0);
      expect(todayStats?.reviewedCards).toBe(1);
      expect(todayStats?.newCards).toBe(0);
      expect(todayStats?.streak).toBe(1);
    });

    it('should increment existing stats for subsequent reviews', async () => {
      await updateStats(Rating.Good, false);
      await updateStats(Rating.Hard, true);
      await updateStats(Rating.Again, false);

      const stats = await storage.getItem<Record<string, DailyStats>>(STORAGE_KEYS.stats);
      const todayStats = stats?.['2024-03-15'];

      expect(todayStats?.totalReviews).toBe(3);
      expect(todayStats?.gradeBreakdown[Rating.Good]).toBe(1);
      expect(todayStats?.gradeBreakdown[Rating.Hard]).toBe(1);
      expect(todayStats?.gradeBreakdown[Rating.Again]).toBe(1);
      expect(todayStats?.gradeBreakdown[Rating.Easy]).toBe(0);
      expect(todayStats?.reviewedCards).toBe(2);
      expect(todayStats?.newCards).toBe(1);
    });

    it('should track new cards separately', async () => {
      await updateStats(Rating.Good, true);
      await updateStats(Rating.Easy, true);
      await updateStats(Rating.Hard, false);

      const stats = await storage.getItem<Record<string, DailyStats>>(STORAGE_KEYS.stats);
      const todayStats = stats?.['2024-03-15'];

      expect(todayStats?.newCards).toBe(2);
      expect(todayStats?.reviewedCards).toBe(1);
      expect(todayStats?.totalReviews).toBe(3);
    });

    it('should continue streak from yesterday', async () => {
      // Create yesterday's stats
      vi.setSystemTime(new Date('2024-03-14T10:00:00'));
      await updateStats(Rating.Good, false);

      // Move to today
      vi.setSystemTime(new Date('2024-03-15T10:00:00'));
      await updateStats(Rating.Good, false);

      const stats = await storage.getItem<Record<string, DailyStats>>(STORAGE_KEYS.stats);
      expect(stats?.['2024-03-14']?.streak).toBe(1);
      expect(stats?.['2024-03-15']?.streak).toBe(2);
    });

    it('should reset streak if yesterday has no stats', async () => {
      // Create stats for 2 days ago
      vi.setSystemTime(new Date('2024-03-13T10:00:00'));
      await updateStats(Rating.Good, false);
      await updateStats(Rating.Easy, false);

      const stats1 = await storage.getItem<Record<string, DailyStats>>(STORAGE_KEYS.stats);
      expect(stats1?.['2024-03-13']?.streak).toBe(1);

      // Skip a day, then create today's stats
      vi.setSystemTime(new Date('2024-03-15T10:00:00'));
      await updateStats(Rating.Good, false);

      const stats2 = await storage.getItem<Record<string, DailyStats>>(STORAGE_KEYS.stats);
      expect(stats2?.['2024-03-15']?.streak).toBe(1); // Reset to 1
    });

    it('should handle all grade types', async () => {
      await updateStats(Rating.Again, false);
      await updateStats(Rating.Hard, false);
      await updateStats(Rating.Good, false);
      await updateStats(Rating.Easy, false);

      const stats = await storage.getItem<Record<string, DailyStats>>(STORAGE_KEYS.stats);
      const todayStats = stats?.['2024-03-15'];

      expect(todayStats?.gradeBreakdown[Rating.Again]).toBe(1);
      expect(todayStats?.gradeBreakdown[Rating.Hard]).toBe(1);
      expect(todayStats?.gradeBreakdown[Rating.Good]).toBe(1);
      expect(todayStats?.gradeBreakdown[Rating.Easy]).toBe(1);
      expect(todayStats?.totalReviews).toBe(4);
    });
  });

  describe('getStatsForDate', () => {
    it('should return null when no stats exist for date', async () => {
      const stats = await getStatsForDate('2024-03-15');
      expect(stats).toBeNull();
    });

    it('should return stats for specific date', async () => {
      await updateStats(Rating.Good, false);
      await updateStats(Rating.Hard, true);

      const stats = await getStatsForDate('2024-03-15');

      expect(stats).toBeDefined();
      expect(stats?.date).toBe('2024-03-15');
      expect(stats?.totalReviews).toBe(2);
      expect(stats?.gradeBreakdown[Rating.Good]).toBe(1);
      expect(stats?.gradeBreakdown[Rating.Hard]).toBe(1);
    });

    it('should return correct stats when multiple dates exist', async () => {
      // Day 1
      vi.setSystemTime(new Date('2024-03-14T10:00:00'));
      await updateStats(Rating.Good, false);

      // Day 2
      vi.setSystemTime(new Date('2024-03-15T10:00:00'));
      await updateStats(Rating.Easy, false);
      await updateStats(Rating.Hard, false);

      // Day 3
      vi.setSystemTime(new Date('2024-03-16T10:00:00'));
      await updateStats(Rating.Again, false);

      const stats14 = await getStatsForDate('2024-03-14');
      const stats15 = await getStatsForDate('2024-03-15');
      const stats16 = await getStatsForDate('2024-03-16');

      expect(stats14?.totalReviews).toBe(1);
      expect(stats15?.totalReviews).toBe(2);
      expect(stats16?.totalReviews).toBe(1);
    });
  });

  describe('getTodayStats', () => {
    it('should return null when no stats exist for today', async () => {
      const stats = await getTodayStats();
      expect(stats).toBeNull();
    });

    it("should return today's stats", async () => {
      await updateStats(Rating.Good, false);
      await updateStats(Rating.Easy, true);

      const stats = await getTodayStats();

      expect(stats).toBeDefined();
      expect(stats?.date).toBe('2024-03-15');
      expect(stats?.totalReviews).toBe(2);
      expect(stats?.newCards).toBe(1);
      expect(stats?.reviewedCards).toBe(1);
    });

    it('should always return current day stats', async () => {
      // Create stats for multiple days
      vi.setSystemTime(new Date('2024-03-14T10:00:00'));
      await updateStats(Rating.Good, false);

      vi.setSystemTime(new Date('2024-03-15T10:00:00'));
      await updateStats(Rating.Easy, false);

      vi.setSystemTime(new Date('2024-03-16T10:00:00'));
      await updateStats(Rating.Hard, false);

      // Check today's stats returns March 16
      const stats = await getTodayStats();
      expect(stats?.date).toBe('2024-03-16');
      expect(stats?.gradeBreakdown[Rating.Hard]).toBe(1);
    });
  });

  describe('getAllStats', () => {
    it('should return empty array when no stats exist', async () => {
      const stats = await getAllStats();
      expect(stats).toEqual([]);
    });

    it('should return all stats sorted by date descending', async () => {
      // Create stats in random order
      vi.setSystemTime(new Date('2024-03-15T10:00:00'));
      await updateStats(Rating.Good, false);

      vi.setSystemTime(new Date('2024-03-13T10:00:00'));
      await updateStats(Rating.Easy, false);

      vi.setSystemTime(new Date('2024-03-16T10:00:00'));
      await updateStats(Rating.Hard, false);

      vi.setSystemTime(new Date('2024-03-14T10:00:00'));
      await updateStats(Rating.Again, false);

      const allStats = await getAllStats();

      expect(allStats).toHaveLength(4);
      expect(allStats[0].date).toBe('2024-03-16');
      expect(allStats[1].date).toBe('2024-03-15');
      expect(allStats[2].date).toBe('2024-03-14');
      expect(allStats[3].date).toBe('2024-03-13');
    });

    it('should return complete stats objects', async () => {
      vi.setSystemTime(new Date('2024-03-15T10:00:00'));
      await updateStats(Rating.Good, false);
      await updateStats(Rating.Hard, true);

      const allStats = await getAllStats();

      expect(allStats).toHaveLength(1);
      const stats = allStats[0];

      expect(stats.date).toBe('2024-03-15');
      expect(stats.totalReviews).toBe(2);
      expect(stats.gradeBreakdown).toBeDefined();
      expect(stats.newCards).toBe(1);
      expect(stats.reviewedCards).toBe(1);
      expect(stats.streak).toBe(1);
    });

    it('should handle stats across months and years', async () => {
      vi.setSystemTime(new Date('2023-12-31T10:00:00'));
      await updateStats(Rating.Good, false);

      vi.setSystemTime(new Date('2024-01-01T10:00:00'));
      await updateStats(Rating.Easy, false);

      vi.setSystemTime(new Date('2024-02-15T10:00:00'));
      await updateStats(Rating.Hard, false);

      const allStats = await getAllStats();

      expect(allStats).toHaveLength(3);
      expect(allStats[0].date).toBe('2024-02-15');
      expect(allStats[1].date).toBe('2024-01-01');
      expect(allStats[2].date).toBe('2023-12-31');
    });
  });
});
