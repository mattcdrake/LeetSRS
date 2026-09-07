import { describe, expect, it } from 'vitest';
import { formatLocalDate } from '../calendar';

describe('calendar bucketing', () => {
  it.each([
    ['2024-03-15T03:59:59.999', 4, '2024-03-14'],
    ['2024-03-15T04:00:00.000', 4, '2024-03-15'],
    ['2024-01-01T03:59:59.999', 4, '2023-12-31'],
    ['2024-01-01T04:00:00.000', 4, '2024-01-01'],
    ['2024-03-01T03:59:59.999', 4, '2024-02-29'],
    ['2024-03-01T04:00:00.000', 4, '2024-03-01'],
  ])('uses the local review day at %s', (instant, dayStartHour, expectedDay) => {
    const referenceDate = new Date(instant);

    expect(formatLocalDate(referenceDate, dayStartHour)).toBe(expectedDay);
    expect(referenceDate.getTime()).toBe(new Date(instant).getTime());
  });
});
