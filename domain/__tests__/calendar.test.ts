import { describe, expect, it } from 'vitest';
import { addLocalDays, formatLocalDate } from '../calendar';

describe('calendar bucketing', () => {
  it.each([
    ['2024-03-14T23:59:59.999', '2024-03-14'],
    ['2024-03-15T00:00:00.000', '2024-03-15'],
    ['2023-12-31T23:59:59.999', '2023-12-31'],
    ['2024-01-01T00:00:00.000', '2024-01-01'],
    ['2024-02-29T23:59:59.999', '2024-02-29'],
    ['2024-03-01T00:00:00.000', '2024-03-01'],
  ])('uses the local calendar date at %s', (instant, expectedDay) => {
    const referenceDate = new Date(instant);

    expect(formatLocalDate(referenceDate)).toBe(expectedDay);
    expect(referenceDate.getTime()).toBe(new Date(instant).getTime());
  });

  it.each([
    ['2024-01-01T00:30:00', -1, '2023-12-31'],
    ['2024-03-01T00:30:00', -1, '2024-02-29'],
    ['2024-02-28T23:30:00', 1, '2024-02-29'],
    ['2024-03-10T23:30:00', -1, '2024-03-09'],
    ['2024-03-10T23:30:00', 1, '2024-03-11'],
    ['2024-11-03T00:30:00', -1, '2024-11-02'],
    ['2024-11-03T00:30:00', 1, '2024-11-04'],
  ])('moves %s by %i local days across calendar and daylight saving boundaries', (instant, days, expected) => {
    const date = new Date(instant);
    expect(formatLocalDate(addLocalDays(date, days))).toBe(expected);
    expect(date.getTime()).toBe(new Date(instant).getTime());
  });
});
