import { State as FsrsState, Rating } from 'ts-fsrs';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fakeBrowser } from 'wxt/testing/fake-browser';
import { storage } from 'wxt/utils/storage';
import type { Card } from '@/domain/cards';
import type { DailyStats } from '@/domain/statistics';
import { getStatsForDate } from '@/infrastructure/storage/stats';
import { STORAGE_KEYS } from '@/infrastructure/storage/storage-keys';
import { buildProblem, createMockCard } from '@/test/utils/card-mocks';
import { addCard } from '../cards';
import { getCardStateStats, getLastNDaysStats, getNextNDaysStats, getTodayStats, updateStats } from '../stats';

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
      await updateStats(Rating.Easy, true);

      const stats = await storage.getItem<Record<string, DailyStats>>(STORAGE_KEYS.stats);
      const todayStats = stats?.['2024-03-15'];

      expect(todayStats?.streak).toBe(1);
      expect(todayStats?.totalReviews).toBe(4);
      expect(todayStats?.gradeBreakdown[Rating.Good]).toBe(1);
      expect(todayStats?.gradeBreakdown[Rating.Hard]).toBe(1);
      expect(todayStats?.gradeBreakdown[Rating.Again]).toBe(1);
      expect(todayStats?.gradeBreakdown[Rating.Easy]).toBe(1);
      expect(todayStats?.reviewedCards).toBe(2);
      expect(todayStats?.newCards).toBe(2);
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
  });

  describe('getStatsForDate', () => {
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

  it('reads only the current day as reviews are saved and the day changes', async () => {
    expect(await getTodayStats()).toBeNull();
    await updateStats(Rating.Good, false);
    await updateStats(Rating.Easy, true);
    expect(await getTodayStats()).toMatchObject({
      date: '2024-03-15',
      totalReviews: 2,
      newCards: 1,
      reviewedCards: 1,
    });

    vi.setSystemTime(new Date('2024-03-16T10:00:00'));
    expect(await getTodayStats()).toBeNull();
    await updateStats(Rating.Hard, false);
    expect(await getTodayStats()).toMatchObject({
      date: '2024-03-16',
      totalReviews: 1,
      gradeBreakdown: { [Rating.Hard]: 1 },
    });
  });

  describe('getLastNDaysStats', () => {
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
  });

  describe('getCardStateStats', () => {
    it.each([null, {}])('returns zero counts for empty storage %j', async (cards) => {
      if (cards !== null) await storage.setItem(STORAGE_KEYS.cards, cards);
      expect(await getCardStateStats()).toEqual({
        [FsrsState.New]: 0,
        [FsrsState.Learning]: 0,
        [FsrsState.Review]: 0,
        [FsrsState.Relearning]: 0,
      });
    });

    it('counts every state, including paused cards', async () => {
      const states = [FsrsState.New, FsrsState.Learning, FsrsState.Review, FsrsState.Review, FsrsState.Relearning];
      const cards = states.map((state, index) =>
        createMockCard(state, { slug: `problem-${index}`, paused: index === 3 })
      );
      await storage.setItem(STORAGE_KEYS.cards, Object.fromEntries(cards.map((card) => [card.slug, card])));

      expect(await getCardStateStats()).toEqual({
        [FsrsState.New]: 1,
        [FsrsState.Learning]: 1,
        [FsrsState.Review]: 2,
        [FsrsState.Relearning]: 1,
      });
    });
  });

  describe('getNextNDaysStats', () => {
    it('buckets stored active cards, folding overdue cards into today and excluding the window end', async () => {
      const cards = [
        ['overdue', '2024-03-14T12:00:00', false],
        ['today', '2024-03-15T12:00:00', false],
        ['tomorrow-early', '2024-03-16T00:00:00', false],
        ['tomorrow-late', '2024-03-16T23:59:59.999', false],
        ['paused', '2024-03-16T12:00:00', true],
        ['outside', '2024-03-17T00:00:00', false],
      ] as const;
      const storedCards = cards.map(([slug, due, paused]) => {
        const card = createMockCard(FsrsState.Review, { slug, paused });
        card.fsrs.due = new Date(due).getTime();
        return card;
      });
      await storage.setItem(STORAGE_KEYS.cards, Object.fromEntries(storedCards.map((card) => [card.slug, card])));

      expect(await getNextNDaysStats(2)).toEqual([
        { date: '2024-03-15', count: 2 },
        { date: '2024-03-16', count: 2 },
      ]);
    });

    it('ignores a legacy day start hour when bucketing upcoming reviews', async () => {
      await storage.setItem('sync:leetsrs:dayStartHour', 4);
      await addCard(buildProblem({ slug: 'problem-1' }));
      const cards = (await storage.getItem(STORAGE_KEYS.cards)) as Record<string, Card>;

      cards['problem-1'].fsrs.due = new Date('2024-03-16T01:00:00').getTime();
      await storage.setItem(STORAGE_KEYS.cards, cards);

      const stats = await getNextNDaysStats(2);

      expect(stats).toEqual([
        { date: '2024-03-15', count: 0 },
        { date: '2024-03-16', count: 1 },
      ]);
    });
  });
});
