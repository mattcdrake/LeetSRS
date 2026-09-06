import { describe, expect, it } from 'vitest';
import { calculateDelayedDueDate } from '../scheduling';

describe('delayed due date', () => {
  it.each([
    ['2024-01-31T10:30:00', 1, '2024-02-01T10:30:00'],
    ['2024-02-28T10:30:00', 1, '2024-02-29T10:30:00'],
    ['2024-12-31T10:30:00', 1, '2025-01-01T10:30:00'],
    ['2024-03-09T10:30:00', 1, '2024-03-10T10:30:00'],
    ['2024-11-02T10:30:00', 1, '2024-11-03T10:30:00'],
    ['2024-03-15T10:30:00', 0, '2024-03-15T10:30:00'],
    ['2024-03-15T10:30:00', -1, '2024-03-14T10:30:00'],
  ])('shifts %s by %i calendar days without modifying the original', (input, days, expected) => {
    const due = new Date(input);
    const result = calculateDelayedDueDate(due, days);

    expect(result).toEqual(new Date(expected));
    expect(result).not.toBe(due);
    expect(due).toEqual(new Date(input));
  });
});
