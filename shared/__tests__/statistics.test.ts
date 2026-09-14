import { describe, expect, it } from 'vitest';
import { createDailyStats } from '@/background/statistics';
import { dailyStatsSchema } from '@/shared/models';

describe('daily statistics schema', () => {
  it('accepts leap days and zero counts while stripping nested unknown fields', () => {
    const stats = createDailyStats(undefined);
    expect(
      dailyStatsSchema.parse({
        ...stats,
        date: '2024-02-29',
        totalReviews: 0,
        reviewedCards: 0,
        extra: true,
        gradeBreakdown: { ...stats.gradeBreakdown, extra: 1 },
      })
    ).toEqual(stats);
  });

  it.each([
    { newCards: 0.5 },
    { streak: -1 },
    { gradeBreakdown: { 1: 0, 2: 0, 3: 0 } },
    { gradeBreakdown: { 1: 0, 2: 0, 3: -1, 4: 0 } },
  ])('rejects malformed statistics %j', (overrides) => {
    expect(dailyStatsSchema.safeParse({ ...createDailyStats(undefined), ...overrides }).success).toBe(false);
  });
});
