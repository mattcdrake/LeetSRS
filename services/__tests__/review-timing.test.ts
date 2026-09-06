import { Rating, State } from 'ts-fsrs';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fakeBrowser } from 'wxt/testing/fake-browser';
import { storage } from 'wxt/utils/storage';
import type { DailyStats } from '@/domain/stats';
import { STORAGE_KEYS } from '@/infrastructure/storage/storage-keys';
import { createMockCard } from '@/test/utils/card-mocks';
import { buildSettings } from '@/test/utils/settings-mocks';
import { formatLocalDate, getReviewQueue, isDueByDate, serializeCard } from '../cards';
import { getSettings } from '../settings';
import { getTodayKey, getYesterdayKey, updateStats } from '../stats';

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

describe('review timing before calculation extraction', () => {
  beforeEach(() => {
    fakeBrowser.reset();
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2024-03-15T03:59:59.999'));
    vi.mocked(getSettings).mockResolvedValue(buildSettings({ dayStartHour: 4 }));
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.useRealTimers();
  });

  it.each([
    ['2024-03-15T03:59:59.999', 4, '2024-03-14', false],
    ['2024-03-15T04:00:00.000', 4, '2024-03-15', true],
    ['2024-01-01T03:59:59.999', 4, '2023-12-31', false],
    ['2024-01-01T04:00:00.000', 4, '2024-01-01', true],
    ['2024-03-01T03:59:59.999', 4, '2024-02-29', false],
    ['2024-03-01T04:00:00.000', 4, '2024-03-01', true],
  ])('uses the local review day at %s', (instant, dayStartHour, expectedDay, due) => {
    const referenceDate = new Date(instant);
    const card = createMockCard(State.Review);
    card.fsrs.due = new Date(referenceDate);
    card.fsrs.due.setHours(4, 0, 0, 0);

    expect(formatLocalDate(referenceDate, dayStartHour)).toBe(expectedDay);
    expect(isDueByDate(card, referenceDate, dayStartHour)).toBe(due);
    expect(referenceDate.getTime()).toBe(new Date(instant).getTime());
  });

  it.each([
    [getTodayKey, '2024-03-14'],
    [getYesterdayKey, '2024-03-13'],
  ])('%s samples its date before awaiting settings', async (getKey, expected) => {
    vi.mocked(getSettings).mockImplementationOnce(async () => {
      vi.setSystemTime(new Date('2024-03-16T12:00:00'));
      return buildSettings({ dayStartHour: 4 });
    });

    await expect(getKey()).resolves.toBe(expected);
    expect(getSettings).toHaveBeenCalledTimes(1);
  });

  it('samples each unpaused card separately, then reads fresh settings and statistics for the daily limit', async () => {
    const due = new Date('2024-03-15T04:00:00');
    const cards = ['paused', 'before', 'after'].map((slug) => {
      const card = createMockCard(State.New, { slug, paused: slug === 'paused' });
      card.fsrs.due = due;
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
    vi.mocked(getSettings)
      .mockResolvedValueOnce(buildSettings({ dayStartHour: 4, maxNewCardsPerDay: 1 }))
      .mockResolvedValueOnce(buildSettings({ dayStartHour: 0, maxNewCardsPerDay: 0 }));

    const ClockDate = Date;
    const samples = [new ClockDate('2024-03-15T03:59:59.999'), due, new ClockDate('2024-03-15T03:00:00')];
    let clockReads = 0;
    vi.stubGlobal(
      'Date',
      new Proxy(ClockDate, {
        construct(target, args) {
          if (args.length === 0) {
            const sample = samples[clockReads++];
            if (!sample) throw new Error('Unexpected additional clock read');
            return new target(sample);
          }
          return Reflect.construct(target, args);
        },
      })
    );

    const queue = await getReviewQueue();

    expect(queue.map((card) => card.slug)).toEqual(['after']);
    expect(clockReads).toBe(3);
    expect(getSettings).toHaveBeenCalledTimes(2);
  });

  it('reads statistics before the clock and independently samples yesterday and its settings when creating a day', async () => {
    await storage.setItem(STORAGE_KEYS.stats, { '2024-03-15': dailyStats('2024-03-15', 0, 7) });
    const getItem = storage.getItem.bind(storage);
    const readStats = vi.spyOn(storage, 'getItem').mockImplementation((key, options) => {
      if (key === STORAGE_KEYS.stats) vi.setSystemTime(new Date('2024-03-15T03:59:59.999'));
      return getItem(key, options);
    });
    vi.setSystemTime(new Date('2024-03-13T12:00:00'));
    vi.mocked(getSettings)
      .mockImplementationOnce(async () => {
        vi.setSystemTime(new Date('2024-03-16T03:00:00'));
        return buildSettings({ dayStartHour: 4 });
      })
      .mockResolvedValueOnce(buildSettings({ dayStartHour: 0 }));

    await updateStats(Rating.Good, true);

    expect(readStats).toHaveBeenCalledTimes(1);
    expect(getSettings).toHaveBeenCalledTimes(2);
    expect(await storage.getItem(STORAGE_KEYS.stats)).toEqual({
      '2024-03-15': dailyStats('2024-03-15', 0, 7),
      '2024-03-14': dailyStats('2024-03-14', 1, 8),
    });
  });

  it('does not read yesterday or settings again when today already exists', async () => {
    await storage.setItem(STORAGE_KEYS.stats, { '2024-03-14': dailyStats('2024-03-14', 1, 3) });

    await updateStats(Rating.Good, true);

    expect(getSettings).toHaveBeenCalledTimes(1);
    expect(await storage.getItem(STORAGE_KEYS.stats)).toEqual({ '2024-03-14': dailyStats('2024-03-14', 2, 3) });
  });
});
