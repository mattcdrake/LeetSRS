import { expect, expectTypeOf, it } from 'vitest';
import { RATINGS, Rating, type Rating as RatingValue, ratingSchema } from '../ratings';

it.each([Rating.Again, Rating.Hard, Rating.Good, Rating.Easy])('accepts review rating %s', (rating) => {
  expectTypeOf<RatingValue>().toEqualTypeOf<1 | 2 | 3 | 4>();
  expect(ratingSchema.parse(rating)).toBe(rating);
});

it('owns the canonical display order', () => {
  expect(RATINGS).toEqual([Rating.Again, Rating.Hard, Rating.Good, Rating.Easy]);
});

it.each([0, 5, -1, 1.5, '1', null, undefined, Number.NaN])('rejects invalid review rating %s', (rating) => {
  expect(ratingSchema.safeParse(rating).success).toBe(false);
});
