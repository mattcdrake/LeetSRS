import { z } from 'zod';

export const Rating = {
  Again: 1,
  Hard: 2,
  Good: 3,
  Easy: 4,
} as const;

export const RATINGS = [Rating.Again, Rating.Hard, Rating.Good, Rating.Easy] as const;
export type Rating = (typeof RATINGS)[number];
export const ratingSchema = z.literal(RATINGS);
