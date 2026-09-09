import { Rating, State } from 'ts-fsrs';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fakeBrowser } from 'wxt/testing/fake-browser';
import { storage } from 'wxt/utils/storage';
import type { DailyStats } from '@/domain/statistics';
import { serializeCard } from '@/infrastructure/storage/cards/codec';
import { STORAGE_KEYS } from '@/infrastructure/storage/storage-keys';
import { createMockCard } from '@/test/utils/card-mocks';
import { buildSettings } from '@/test/utils/settings-mocks';
import { getReviewQueue, isDueByDate } from '../cards';
import { getSettings } from '../settings';
import { getLastNDaysStats, getNextNDaysStats, getTodayKey, getYesterdayKey, updateStats } from '../stats';

vi.mock('../settings', () => ({ getSettings: vi.fn() }));

function dailyStats(date: string, newCards: number, streak = 1): DailyStats {
  return {
    date,
    streak,
    newCards,
    reviewedCards: 0,
    totalReviews: newCards,
    gradeBreakdown: { [Rating.Again]: 0, [Rating.Hard]: 0, [Rating.Good]: newCards, [Rating.Easy]: 0 },
  };
}

describe('review-day service integration', () => {
  beforeEach(() => {
    fakeBrowser.reset();
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2024-03-15T03:59:59.999'));
    vi.mocked(getSettings).mockResolvedValue(buildSettings({ dayStartHour: 4 }));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('defaults an omitted reference date to the service clock at each call', () => {
    const card = createMockCard(State.Review);
    card.fsrs.due = new Date('2024-03-15T04:00:00').getTime();

    expect(isDueByDate(card, undefined, 4)).toBe(false);
    vi.setSystemTime(new Date('2024-03-15T04:00:00'));
    expect(isDueByDate(card, undefined, 4)).toBe(true);
  });

  it.each([
    [getTodayKey, '2024-03-14'],
    [getYesterdayKey, '2024-03-13'],
  ])('%s uses the configured review-day boundary', async (getKey, expected) => {
    await expect(getKey()).resolves.toBe(expected);
  });

  it('uses the review day for due cards and the daily new-card allowance', async () => {
    const cards = ['paused', 'new-a', 'new-b', 'future'].map((slug) => {
      const card = createMockCard(State.New, { slug, paused: slug === 'paused' });
      card.fsrs.due = new Date(slug === 'future' ? '2024-03-15T04:00:00' : '2024-03-14T12:00:00').getTime();
      return card;
    });
    await storage.setItem(
      STORAGE_KEYS.cards,
      Object.fromEntries(cards.map((card) => [card.slug, serializeCard(card)]))
    );
    await storage.setItem(STORAGE_KEYS.stats, {
      '2024-03-14': dailyStats('2024-03-14', 1),
      '2024-03-15': dailyStats('2024-03-15', 0),
    });
    vi.mocked(getSettings).mockResolvedValue(buildSettings({ dayStartHour: 4, maxNewCardsPerDay: 2 }));

    expect((await getReviewQueue()).map((card) => card.slug)).toEqual(['new-a']);
  });

  it('continues the previous review day streak when creating stats before the day boundary', async () => {
    await storage.setItem(STORAGE_KEYS.stats, { '2024-03-13': dailyStats('2024-03-13', 1, 7) });

    await updateStats(Rating.Good, true);

    expect(await storage.getItem(STORAGE_KEYS.stats)).toEqual({
      '2024-03-13': dailyStats('2024-03-13', 1, 7),
      '2024-03-14': dailyStats('2024-03-14', 1, 8),
    });
  });

  it.each([getLastNDaysStats, getNextNDaysStats])('%s anchors buckets to the review day', async (getBuckets) => {
    expect(await getBuckets(1)).toEqual([expect.objectContaining({ date: '2024-03-14' })]);
    expect(await getBuckets(0)).toEqual([]);
  });

  it('preserves the streak when adding to an existing review day', async () => {
    await storage.setItem(STORAGE_KEYS.stats, { '2024-03-14': dailyStats('2024-03-14', 1, 3) });

    await updateStats(Rating.Good, true);

    expect(await storage.getItem(STORAGE_KEYS.stats)).toEqual({ '2024-03-14': dailyStats('2024-03-14', 2, 3) });
  });
});
