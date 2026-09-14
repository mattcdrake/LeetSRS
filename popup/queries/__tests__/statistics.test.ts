import { describe, expect, it } from 'vitest';
import { calculateHistoryStats, calculateUpcomingStats } from '@/popup/queries/statistics';

describe('statistics calculations', () => {
  it.each([
    ['2024-12-31T23:30:00', ['2024-12-30', '2024-12-31'], ['2024-12-31', '2025-01-01']],
    ['2024-03-10T23:30:00', ['2024-03-09', '2024-03-10'], ['2024-03-10', '2024-03-11']],
    ['2024-11-03T00:30:00', ['2024-11-02', '2024-11-03'], ['2024-11-03', '2024-11-04']],
  ])('keeps chart buckets on consecutive local dates at %s', (instant, history, upcoming) => {
    const today = new Date(instant);
    expect(calculateHistoryStats({}, 2, today).map((day) => day.date)).toEqual(history);
    expect(calculateUpcomingStats([], 2, today).map((day) => day.date)).toEqual(upcoming);
  });
});
