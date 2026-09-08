import { expect, it } from 'vitest';
import { RATINGS } from '../ratings';

it('defines the four review grades in FSRS order with stable semantic keys', () => {
  expect(RATINGS).toEqual([
    { rating: 1, key: 'again' },
    { rating: 2, key: 'hard' },
    { rating: 3, key: 'good' },
    { rating: 4, key: 'easy' },
  ]);
});
