import { describe, expect, it } from 'vitest';
import { recordReview } from '@/background/review-activity';

describe('review activity', () => {
  it.each([
    ['2024-03-15T00:00:00', undefined, '2024-03-15', 1],
    ['2024-03-15T00:00:00', '2024-03-13', '2024-03-15', 1],
    ['2025-01-01T00:00:00', '2024-12-31', '2025-01-01', 8],
    ['2024-03-10T23:59:59.999', '2024-03-09', '2024-03-10', 8],
    ['2024-11-03T23:59:59.999', '2024-11-02', '2024-11-03', 8],
  ] as const)('records a review at %s with prior day %s', (instant, priorDay, today, streak) => {
    const stats = priorDay ? { date: priorDay, newCards: 0, streak: 7 } : null;
    const before = structuredClone(stats);
    const now = new Date(instant);
    const result = recordReview(stats, now, true);

    expect(result).toEqual({
      date: today,
      streak,
      newCards: 1,
    });
    expect(stats).toEqual(before);
    expect(now).toEqual(new Date(instant));
  });

  it('continues streaks and counts only new cards', () => {
    const yesterday = recordReview(null, new Date('2024-03-14T12:00:00'), true);
    const before = structuredClone(yesterday);
    const now = new Date('2024-03-15T12:00:00');
    let stats = recordReview(yesterday, now, true);
    const firstReview = stats;
    const firstReviewBefore = structuredClone(firstReview);
    stats = recordReview(stats, now, false);
    stats = recordReview(stats, now, false);
    stats = recordReview(stats, now, true);
    expect(stats).toEqual({
      date: '2024-03-15',
      streak: 2,
      newCards: 2,
    });
    expect(yesterday).toEqual(before);
    expect(firstReview).toEqual(firstReviewBefore);
  });
});
