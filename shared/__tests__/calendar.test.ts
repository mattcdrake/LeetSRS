import { describe, expect, it } from 'vitest';
import { addLocalDays, formatLocalDate } from '@/shared/calendar';

describe('calendar bucketing', () => {
  it.each([
    ['2024-01-01T00:30:00', -1, '2023-12-31'],
    ['2024-03-01T00:30:00', -1, '2024-02-29'],
    ['2024-03-10T23:30:00', -1, '2024-03-09'],
    ['2024-11-03T00:30:00', -1, '2024-11-02'],
  ])('moves %s by %i local days across calendar and daylight saving boundaries', (instant, days, expected) => {
    const date = new Date(instant);
    expect(formatLocalDate(addLocalDays(date, days))).toBe(expected);
    expect(date.getTime()).toBe(new Date(instant).getTime());
  });
});
