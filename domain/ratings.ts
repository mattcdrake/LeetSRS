import { type Grade, Rating } from 'ts-fsrs';
import { z } from 'zod';

export const ratingSchema = z.literal([Rating.Again, Rating.Hard, Rating.Good, Rating.Easy]) satisfies z.ZodType<Grade>;
export type ReviewRating = z.infer<typeof ratingSchema>;
