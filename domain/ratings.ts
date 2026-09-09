import { type Grade, Rating } from 'ts-fsrs';
import { z } from 'zod';

export const ratingSchema = z.union([
  z.literal(Rating.Again),
  z.literal(Rating.Hard),
  z.literal(Rating.Good),
  z.literal(Rating.Easy),
]) satisfies z.ZodType<Grade>;
export type ReviewRating = z.infer<typeof ratingSchema>;

export const RATINGS = [
  { rating: Rating.Again, key: 'again' },
  { rating: Rating.Hard, key: 'hard' },
  { rating: Rating.Good, key: 'good' },
  { rating: Rating.Easy, key: 'easy' },
] as const satisfies readonly { rating: Grade; key: string }[];

export type RatingKey = (typeof RATINGS)[number]['key'];
