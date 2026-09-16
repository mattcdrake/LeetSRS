import { describe, expect, it } from 'vitest';
import { calculateDelayedDueDate } from '@/background/learning';

describe('delayed due date', () => {
  it.each([
    ['2024-01-31T10:30:00', 1, '2024-02-01T10:30:00'],
    ['2024-02-28T10:30:00', 1, '2024-02-29T10:30:00'],
    ['2024-12-31T10:30:00', 1, '2025-01-01T10:30:00'],
  ])('shifts %s by %i local calendar days', (input, days, expected) => {
    const due = new Date(input).getTime();
    const result = calculateDelayedDueDate(due, days);

    expect(result).toBe(new Date(expected).getTime());
  });
});
