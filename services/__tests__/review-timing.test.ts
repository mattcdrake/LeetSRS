import { Rating, State } from 'ts-fsrs';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fakeBrowser } from 'wxt/testing/fake-browser';
import { storage } from 'wxt/utils/storage';
import type { DailyStats } from '@/domain/statistics';
import { STORAGE_KEYS } from '@/infrastructure/storage/storage-keys';
import { buildProblem, createMockCard } from '@/test/utils/card-mocks';
import { getReviewQueue, rateCard } from '../cards';
import { updateSettings } from '../settings';
import { getLastNDaysStats, getNextNDaysStats, updateStats } from '../stats';

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

describe('review timing service integration', () => {
  beforeEach(() => {
    fakeBrowser.reset();
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2024-03-15T00:00:00.000'));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('keeps card creation, scheduling, and statistics on the rating start day across midnight', async () => {
    vi.setSystemTime(new Date('2024-03-14T23:59:59.999'));
    await storage.setItem(STORAGE_KEYS.stats, { '2024-03-13': dailyStats('2024-03-13', 1, 7) });
    const get = fakeBrowser.storage.local.get.bind(fakeBrowser.storage.local);
    vi.spyOn(fakeBrowser.storage.local, 'get').mockImplementationOnce(async (keys) => {
      const result = await get(keys);
      vi.setSystemTime(new Date('2024-03-15T00:00:00'));
      return result;
    });

    const { card } = await rateCard({ ...buildProblem(), rating: Rating.Good });

    expect(card.createdAt).toBe(new Date('2024-03-14T23:59:59.999').getTime());
    expect(card.fsrs.last_review).toBe(card.createdAt);
    expect(await getLastNDaysStats(2)).toEqual([dailyStats('2024-03-14', 1, 8), dailyStats('2024-03-15', 0, 0)]);
  });

  it('keeps queue eligibility and allowance on the captured time and settings during a read', async () => {
    vi.setSystemTime(new Date('2024-03-14T23:59:59.999'));
    const cards = ['new-a', 'new-b', 'future'].map((slug) => {
      const card = createMockCard(State.New, { slug });
      if (slug === 'future') card.fsrs.due = new Date('2024-03-15T00:00:00').getTime();
      return card;
    });
    await storage.setItem(STORAGE_KEYS.cards, Object.fromEntries(cards.map((card) => [card.slug, card])));
    await storage.setItem(STORAGE_KEYS.stats, { '2024-03-14': dailyStats('2024-03-14', 1) });
    await updateSettings({ maxNewCardsPerDay: 2 });
    const get = fakeBrowser.storage.local.get.bind(fakeBrowser.storage.local);
    vi.spyOn(fakeBrowser.storage.local, 'get').mockImplementationOnce(async (keys) => {
      const result = await get(keys);
      vi.setSystemTime(new Date('2024-03-15T00:00:00'));
      await updateSettings({ maxNewCardsPerDay: 3 });
      return result;
    });

    expect((await getReviewQueue()).map((card) => card.slug)).toEqual(['new-a']);
    expect((await getReviewQueue()).map((card) => card.slug)).toEqual(['new-a', 'new-b', 'future']);
  });

  it('uses exact due times and resets the daily new-card allowance at midnight', async () => {
    const cards = ['paused', 'new-a', 'new-b', 'future'].map((slug) => {
      const card = createMockCard(State.New, { slug, paused: slug === 'paused' });
      card.fsrs.due = new Date(slug === 'future' ? '2024-03-15T04:00:00' : '2024-03-14T12:00:00').getTime();
      return card;
    });
    await storage.setItem(STORAGE_KEYS.cards, Object.fromEntries(cards.map((card) => [card.slug, card])));
    await storage.setItem(STORAGE_KEYS.stats, {
      '2024-03-14': dailyStats('2024-03-14', 2),
      '2024-03-15': dailyStats('2024-03-15', 1),
    });
    await updateSettings({ maxNewCardsPerDay: 2 });

    vi.setSystemTime(new Date('2024-03-14T23:59:59.999'));
    expect(await getReviewQueue()).toEqual([]);
    vi.setSystemTime(new Date('2024-03-15T00:00:00'));
    expect((await getReviewQueue()).map((card) => card.slug)).toEqual(['new-a']);
  });

  it.each([
    ['2024-03-15T00:00:00', '2024-03-14', '2024-03-15'],
    ['2024-01-01T00:00:00', '2023-12-31', '2024-01-01'],
    ['2024-03-11T00:00:00', '2024-03-10', '2024-03-11'],
    ['2024-11-04T00:00:00', '2024-11-03', '2024-11-04'],
  ])('continues the streak at local midnight %s', async (instant, yesterday, today) => {
    vi.setSystemTime(new Date(instant));
    await storage.setItem(STORAGE_KEYS.stats, { [yesterday]: dailyStats(yesterday, 1, 7) });

    await updateStats(Rating.Good, true);

    expect(await storage.getItem(STORAGE_KEYS.stats)).toEqual({
      [yesterday]: dailyStats(yesterday, 1, 7),
      [today]: dailyStats(today, 1, 8),
    });
  });

  it.each([getLastNDaysStats, getNextNDaysStats])(
    '%s anchors buckets to the initial local day when a read crosses midnight',
    async (getBuckets) => {
      const get = fakeBrowser.storage.local.get.bind(fakeBrowser.storage.local);
      vi.spyOn(fakeBrowser.storage.local, 'get').mockImplementationOnce(async (keys) => {
        const result = await get(keys);
        vi.setSystemTime(new Date('2024-03-16T00:00:00'));
        return result;
      });
      expect(await getBuckets(1)).toEqual([expect.objectContaining({ date: '2024-03-15' })]);
      expect(await getBuckets(0)).toEqual([]);
    }
  );

  it('preserves the streak when adding to an existing local calendar day', async () => {
    await storage.setItem(STORAGE_KEYS.stats, { '2024-03-15': dailyStats('2024-03-15', 1, 3) });

    await updateStats(Rating.Good, true);

    expect(await storage.getItem(STORAGE_KEYS.stats)).toEqual({ '2024-03-15': dailyStats('2024-03-15', 2, 3) });
  });
});
