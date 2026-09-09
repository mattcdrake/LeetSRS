import type { Grade } from 'ts-fsrs';
import { expect, expectTypeOf, it } from 'vitest';
import { type ReviewRating, ratingSchema } from '../ratings';

it.each([1, 2, 3, 4])('accepts review rating %s', (rating) => {
  expectTypeOf<ReviewRating>().toEqualTypeOf<Grade>();
  expect(ratingSchema.parse(rating)).toBe(rating);
});

it.each([0, 5, -1, 1.5, '1', null, undefined, Number.NaN])('rejects invalid review rating %s', (rating) => {
  expect(ratingSchema.safeParse(rating).success).toBe(false);
});
