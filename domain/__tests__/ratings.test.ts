import type { Grade } from 'ts-fsrs';
import { expect, expectTypeOf, it } from 'vitest';
import { RATINGS, type ReviewRating, ratingSchema } from '../ratings';

it('defines the four review grades in FSRS order with stable semantic keys', () => {
  expect(RATINGS).toEqual([
    { rating: 1, key: 'again' },
    { rating: 2, key: 'hard' },
    { rating: 3, key: 'good' },
    { rating: 4, key: 'easy' },
  ]);
});

it.each([1, 2, 3, 4])('accepts review rating %s', (rating) => {
  expectTypeOf<ReviewRating>().toEqualTypeOf<Grade>();
  expect(ratingSchema.parse(rating)).toBe(rating);
});

it.each([0, 5, -1, 1.5, '1', null, undefined, Number.NaN])('rejects invalid review rating %s', (rating) => {
  expect(ratingSchema.safeParse(rating).success).toBe(false);
});
