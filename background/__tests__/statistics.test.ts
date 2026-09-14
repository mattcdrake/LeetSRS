import { Rating } from 'ts-fsrs';
import { describe, expect, it } from 'vitest';
import { createDailyStats, recordReview } from '@/background/statistics';

describe('review statistics', () => {
  it.each([
    ['2024-03-15T00:00:00', undefined, '2024-03-15', 1],
    ['2024-03-15T00:00:00', '2024-03-13', '2024-03-15', 1],
    ['2025-01-01T00:00:00', '2024-12-31', '2025-01-01', 8],
    ['2024-03-10T23:59:59.999', '2024-03-09', '2024-03-10', 8],
    ['2024-11-03T23:59:59.999', '2024-11-02', '2024-11-03', 8],
  ] as const)('records a review at %s with prior day %s', (instant, priorDay, today, streak) => {
    const stats = priorDay ? { [priorDay]: { ...createDailyStats(undefined), streak: 7 } } : {};
    const before = structuredClone(stats);
    const now = new Date(instant);
    const result = recordReview(stats, now, Rating.Good, true);

    expect(result).toEqual({
      ...before,
      [today]: {
        streak,
        newCards: 1,
        gradeBreakdown: { [Rating.Again]: 0, [Rating.Hard]: 0, [Rating.Good]: 1, [Rating.Easy]: 0 },
      },
    });
    expect(stats).toEqual(before);
    expect(now).toEqual(new Date(instant));
  });

  it('continues streaks and accumulates each grade and card category', () => {
    const yesterday = recordReview({}, new Date('2024-03-14T12:00:00'), Rating.Good, true);
    const before = structuredClone(yesterday);
    const now = new Date('2024-03-15T12:00:00');
    let stats = recordReview(yesterday, now, Rating.Again, true);
    const firstReview = stats;
    const firstReviewBefore = structuredClone(firstReview);
    stats = recordReview(stats, now, Rating.Hard, false);
    stats = recordReview(stats, now, Rating.Good, false);
    stats = recordReview(stats, now, Rating.Easy, true);
    expect(stats).toEqual({
      ...before,
      '2024-03-15': {
        streak: 2,
        newCards: 2,
        gradeBreakdown: { [Rating.Again]: 1, [Rating.Hard]: 1, [Rating.Good]: 1, [Rating.Easy]: 1 },
      },
    });
    expect(yesterday).toEqual(before);
    expect(firstReview).toEqual(firstReviewBefore);
  });
});
