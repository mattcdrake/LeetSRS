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
  getCardStateStats,
  getLastNDaysStats,
  getNextNDaysStats,
  type DailyStats,
} from '../stats';
import { Rating, State as FsrsState } from 'ts-fsrs';
import { STORAGE_KEYS } from '../storage-keys';
import { addCard } from '../cards';
import type { Difficulty } from '@/shared/cards';
import type { StoredCard } from '../cards';

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

    it('should maintain streak across multiple consecutive days', async () => {
      // Day 1
      vi.setSystemTime(new Date('2024-03-10T10:00:00'));
      await updateStats(Rating.Good, false);

      // Day 2
      vi.setSystemTime(new Date('2024-03-11T10:00:00'));
      await updateStats(Rating.Easy, false);

      // Day 3
      vi.setSystemTime(new Date('2024-03-12T10:00:00'));
      await updateStats(Rating.Good, false);

      // Day 4
      vi.setSystemTime(new Date('2024-03-13T10:00:00'));
      await updateStats(Rating.Hard, false);

      // Day 5
      vi.setSystemTime(new Date('2024-03-14T10:00:00'));
      await updateStats(Rating.Good, false);

      const stats = await storage.getItem<Record<string, DailyStats>>(STORAGE_KEYS.stats);

      expect(stats?.['2024-03-10']?.streak).toBe(1);
      expect(stats?.['2024-03-11']?.streak).toBe(2);
      expect(stats?.['2024-03-12']?.streak).toBe(3);
      expect(stats?.['2024-03-13']?.streak).toBe(4);
      expect(stats?.['2024-03-14']?.streak).toBe(5);
    });

    it('should not increment streak for multiple reviews on same day', async () => {
      await updateStats(Rating.Good, false);
      await updateStats(Rating.Easy, false);
      await updateStats(Rating.Hard, false);

      const stats = await storage.getItem<Record<string, DailyStats>>(STORAGE_KEYS.stats);
      expect(stats?.['2024-03-15']?.streak).toBe(1);
      expect(stats?.['2024-03-15']?.totalReviews).toBe(3);
    });

    it('should handle streak reset after multiple day gap', async () => {
      // Create a 3-day streak
      vi.setSystemTime(new Date('2024-03-10T10:00:00'));
      await updateStats(Rating.Good, false);

      vi.setSystemTime(new Date('2024-03-11T10:00:00'));
      await updateStats(Rating.Good, false);

      vi.setSystemTime(new Date('2024-03-12T10:00:00'));
      await updateStats(Rating.Good, false);

      // Skip 2 days
      vi.setSystemTime(new Date('2024-03-15T10:00:00'));
      await updateStats(Rating.Good, false);

      const stats = await storage.getItem<Record<string, DailyStats>>(STORAGE_KEYS.stats);
      expect(stats?.['2024-03-12']?.streak).toBe(3);
      expect(stats?.['2024-03-15']?.streak).toBe(1); // Reset to 1
    });

    it('should start streak at 1 for first ever review', async () => {
      await updateStats(Rating.Good, false);

      const stats = await storage.getItem<Record<string, DailyStats>>(STORAGE_KEYS.stats);
      expect(stats?.['2024-03-15']?.streak).toBe(1);
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

  describe('getLastNDaysStats', () => {
    it('should return empty days when no stats exist', async () => {
      const stats = await getLastNDaysStats(7);

      expect(stats).toHaveLength(7);
      stats.forEach((stat) => {
        expect(stat.totalReviews).toBe(0);
        expect(stat.newCards).toBe(0);
        expect(stat.reviewedCards).toBe(0);
        expect(stat.gradeBreakdown[Rating.Again]).toBe(0);
        expect(stat.gradeBreakdown[Rating.Hard]).toBe(0);
        expect(stat.gradeBreakdown[Rating.Good]).toBe(0);
        expect(stat.gradeBreakdown[Rating.Easy]).toBe(0);
      });
    });

    it('should return last N days in chronological order', async () => {
      // Create stats for specific days
      vi.setSystemTime(new Date('2024-03-10T10:00:00'));
      await updateStats(Rating.Good, false);

      vi.setSystemTime(new Date('2024-03-12T10:00:00'));
      await updateStats(Rating.Easy, false);

      vi.setSystemTime(new Date('2024-03-15T10:00:00'));
      await updateStats(Rating.Hard, false);

      // Request last 7 days from March 15
      const stats = await getLastNDaysStats(7);

      expect(stats).toHaveLength(7);
      expect(stats[0].date).toBe('2024-03-09'); // 6 days ago
      expect(stats[1].date).toBe('2024-03-10'); // 5 days ago (has data)
      expect(stats[2].date).toBe('2024-03-11'); // 4 days ago
      expect(stats[3].date).toBe('2024-03-12'); // 3 days ago (has data)
      expect(stats[4].date).toBe('2024-03-13'); // 2 days ago
      expect(stats[5].date).toBe('2024-03-14'); // 1 day ago
      expect(stats[6].date).toBe('2024-03-15'); // today (has data)

      // Check that days with data have correct values
      expect(stats[1].totalReviews).toBe(1);
      expect(stats[1].gradeBreakdown[Rating.Good]).toBe(1);

      expect(stats[3].totalReviews).toBe(1);
      expect(stats[3].gradeBreakdown[Rating.Easy]).toBe(1);

      expect(stats[6].totalReviews).toBe(1);
      expect(stats[6].gradeBreakdown[Rating.Hard]).toBe(1);
    });

    it('should handle large number of days', async () => {
      const stats = await getLastNDaysStats(45);

      expect(stats).toHaveLength(45);

      // Check first and last dates
      const firstDate = new Date('2024-03-15');
      firstDate.setDate(firstDate.getDate() - 44);
      expect(stats[0].date).toBe('2024-01-31');
      expect(stats[44].date).toBe('2024-03-15');
    });

    it('should include all grade breakdowns for each day', async () => {
      vi.setSystemTime(new Date('2024-03-15T10:00:00'));
      await updateStats(Rating.Again, false);
      await updateStats(Rating.Hard, false);
      await updateStats(Rating.Good, false);
      await updateStats(Rating.Easy, false);

      const stats = await getLastNDaysStats(1);

      expect(stats).toHaveLength(1);
      const todayStats = stats[0];
      expect(todayStats.date).toBe('2024-03-15');
      expect(todayStats.totalReviews).toBe(4);
      expect(todayStats.gradeBreakdown[Rating.Again]).toBe(1);
      expect(todayStats.gradeBreakdown[Rating.Hard]).toBe(1);
      expect(todayStats.gradeBreakdown[Rating.Good]).toBe(1);
      expect(todayStats.gradeBreakdown[Rating.Easy]).toBe(1);
    });
  });

  describe('getCardStateStats', () => {
    beforeEach(() => {
      fakeBrowser.reset();
    });

    it('should return all zeros when no cards exist', async () => {
      const stats = await getCardStateStats();

      expect(stats[FsrsState.New]).toBe(0);
      expect(stats[FsrsState.Learning]).toBe(0);
      expect(stats[FsrsState.Review]).toBe(0);
      expect(stats[FsrsState.Relearning]).toBe(0);
    });

    it('should count cards by state correctly', async () => {
      // Add some cards - new cards start in New state
      await addCard('two-sum', 'Two Sum', '1', 'Easy' as Difficulty);
      await addCard('add-two-numbers', 'Add Two Numbers', '2', 'Medium' as Difficulty);
      await addCard('longest-substring', 'Longest Substring', '3', 'Medium' as Difficulty);

      const stats = await getCardStateStats();

      expect(stats[FsrsState.New]).toBe(3);
      expect(stats[FsrsState.Learning]).toBe(0);
      expect(stats[FsrsState.Review]).toBe(0);
      expect(stats[FsrsState.Relearning]).toBe(0);
    });

    it('should count all fsrs states correctly', async () => {
      // Add cards with different states by manipulating storage directly
      const cards = [
        {
          id: '1',
          slug: 'problem-1',
          name: 'Problem 1',
          leetcodeId: '1',
          difficulty: 'Easy' as Difficulty,
          createdAt: Date.now(),
          paused: false,
          fsrs: {
            due: Date.now(),
            last_review: null,
            state: FsrsState.New,
            stability: 0,
            difficulty: 0,
            elapsed_days: 0,
            scheduled_days: 0,
            reps: 0,
            lapses: 0,
          },
        },
        {
          id: '2',
          slug: 'problem-2',
          name: 'Problem 2',
          leetcodeId: '2',
          difficulty: 'Medium' as Difficulty,
          createdAt: Date.now(),
          paused: false,
          fsrs: {
            due: Date.now(),
            last_review: Date.now(),
            state: FsrsState.Learning,
            stability: 1,
            difficulty: 5,
            elapsed_days: 1,
            scheduled_days: 1,
            reps: 1,
            lapses: 0,
          },
        },
        {
          id: '3',
          slug: 'problem-3',
          name: 'Problem 3',
          leetcodeId: '3',
          difficulty: 'Hard' as Difficulty,
          createdAt: Date.now(),
          paused: false,
          fsrs: {
            due: Date.now(),
            last_review: Date.now(),
            state: FsrsState.Review,
            stability: 10,
            difficulty: 5,
            elapsed_days: 5,
            scheduled_days: 10,
            reps: 5,
            lapses: 0,
          },
        },
        {
          id: '4',
          slug: 'problem-4',
          name: 'Problem 4',
          leetcodeId: '4',
          difficulty: 'Hard' as Difficulty,
          createdAt: Date.now(),
          paused: false,
          fsrs: {
            due: Date.now(),
            last_review: Date.now(),
            state: FsrsState.Review,
            stability: 20,
            difficulty: 6,
            elapsed_days: 10,
            scheduled_days: 20,
            reps: 10,
            lapses: 0,
          },
        },
        {
          id: '5',
          slug: 'problem-5',
          name: 'Problem 5',
          leetcodeId: '5',
          difficulty: 'Medium' as Difficulty,
          createdAt: Date.now(),
          paused: false,
          fsrs: {
            due: Date.now(),
            last_review: Date.now(),
            state: FsrsState.Relearning,
            stability: 2,
            difficulty: 7,
            elapsed_days: 15,
            scheduled_days: 2,
            reps: 15,
            lapses: 2,
          },
        },
      ];

      await storage.setItem(STORAGE_KEYS.cards, cards);

      const stats = await getCardStateStats();

      expect(stats[FsrsState.New]).toBe(1);
      expect(stats[FsrsState.Learning]).toBe(1);
      expect(stats[FsrsState.Review]).toBe(2);
      expect(stats[FsrsState.Relearning]).toBe(1);
    });

    it('should handle empty card array', async () => {
      await storage.setItem(STORAGE_KEYS.cards, []);

      const stats = await getCardStateStats();

      expect(stats[FsrsState.New]).toBe(0);
      expect(stats[FsrsState.Learning]).toBe(0);
      expect(stats[FsrsState.Review]).toBe(0);
      expect(stats[FsrsState.Relearning]).toBe(0);
    });

    it('should return type-safe Record<FsrsState, number>', async () => {
      const stats = await getCardStateStats();

      // TypeScript should enforce that stats has all FsrsState keys
      const states: FsrsState[] = [FsrsState.New, FsrsState.Learning, FsrsState.Review, FsrsState.Relearning];

      states.forEach((state) => {
        expect(typeof stats[state]).toBe('number');
        expect(stats[state]).toBeGreaterThanOrEqual(0);
      });
    });
  });

  describe('getNextNDaysStats', () => {
    beforeEach(() => {
      fakeBrowser.reset();
      vi.setSystemTime(new Date('2024-03-15T10:00:00'));
    });

    it('should return empty counts when no cards exist', async () => {
      const stats = await getNextNDaysStats(7);

      expect(stats).toHaveLength(7);
      expect(stats[0].date).toBe('2024-03-15');
      expect(stats[6].date).toBe('2024-03-21');
      stats.forEach((stat) => {
        expect(stat.count).toBe(0);
      });
    });

    it('should count cards due today', async () => {
      // Add a card that's due today
      await addCard('problem-1', 'Problem 1', '1', 'Easy' as Difficulty);
      const cards = (await storage.getItem(STORAGE_KEYS.cards)) as Record<string, StoredCard>;

      // Manually set the card to be due today
      cards['problem-1'].fsrs.due = new Date('2024-03-15T12:00:00').getTime();
      await storage.setItem(STORAGE_KEYS.cards, cards);

      const stats = await getNextNDaysStats(7);

      expect(stats[0].date).toBe('2024-03-15');
      expect(stats[0].count).toBe(1);
      expect(stats[1].count).toBe(0); // Not counted again tomorrow
    });

    it('should count cards due in the future', async () => {
      // Add cards with different due dates
      await addCard('problem-1', 'Problem 1', '1', 'Easy' as Difficulty);
      await addCard('problem-2', 'Problem 2', '2', 'Medium' as Difficulty);
      await addCard('problem-3', 'Problem 3', '3', 'Hard' as Difficulty);

      const cards = (await storage.getItem(STORAGE_KEYS.cards)) as Record<string, StoredCard>;

      // Set different due dates
      cards['problem-1'].fsrs.due = new Date('2024-03-15T12:00:00').getTime(); // Today
      cards['problem-2'].fsrs.due = new Date('2024-03-17T12:00:00').getTime(); // In 2 days
      cards['problem-3'].fsrs.due = new Date('2024-03-20T12:00:00').getTime(); // In 5 days
      await storage.setItem(STORAGE_KEYS.cards, cards);

      const stats = await getNextNDaysStats(7);

      expect(stats[0].count).toBe(1); // problem-1 due today
      expect(stats[1].count).toBe(0);
      expect(stats[2].count).toBe(1); // problem-2 due in 2 days
      expect(stats[3].count).toBe(0);
      expect(stats[4].count).toBe(0);
      expect(stats[5].count).toBe(1); // problem-3 due in 5 days
      expect(stats[6].count).toBe(0);
    });

    it('should not count paused cards', async () => {
      // Add cards
      await addCard('problem-1', 'Problem 1', '1', 'Easy' as Difficulty);
      await addCard('problem-2', 'Problem 2', '2', 'Medium' as Difficulty);

      const cards = (await storage.getItem(STORAGE_KEYS.cards)) as Record<string, StoredCard>;

      // Both due today, but one is paused
      cards['problem-1'].fsrs.due = new Date('2024-03-15T12:00:00').getTime();
      cards['problem-1'].paused = true;
      cards['problem-2'].fsrs.due = new Date('2024-03-15T12:00:00').getTime();
      cards['problem-2'].paused = false;
      await storage.setItem(STORAGE_KEYS.cards, cards);

      const stats = await getNextNDaysStats(7);

      expect(stats[0].count).toBe(1); // Only the non-paused card
    });

    it('should handle cards due in the past', async () => {
      // Add cards due in the past
      await addCard('problem-1', 'Problem 1', '1', 'Easy' as Difficulty);
      await addCard('problem-2', 'Problem 2', '2', 'Medium' as Difficulty);

      const cards = (await storage.getItem(STORAGE_KEYS.cards)) as Record<string, StoredCard>;

      cards['problem-1'].fsrs.due = new Date('2024-03-10T12:00:00').getTime(); // 5 days ago
      cards['problem-2'].fsrs.due = new Date('2024-03-14T12:00:00').getTime(); // Yesterday
      await storage.setItem(STORAGE_KEYS.cards, cards);

      const stats = await getNextNDaysStats(7);

      // Both cards are overdue, so they should be counted on the first day (today)
      expect(stats[0].count).toBe(2);
      expect(stats[1].count).toBe(0);
    });

    it('should handle large number of days', async () => {
      const stats = await getNextNDaysStats(30);

      expect(stats).toHaveLength(30);
      expect(stats[0].date).toBe('2024-03-15');
      expect(stats[29].date).toBe('2024-04-13');
    });
  });
});
