import { type Grade, Rating } from 'ts-fsrs';

export const RATINGS = [
  { rating: Rating.Again, key: 'again' },
  { rating: Rating.Hard, key: 'hard' },
  { rating: Rating.Good, key: 'good' },
  { rating: Rating.Easy, key: 'easy' },
] as const satisfies readonly { rating: Grade; key: string }[];

export type RatingKey = (typeof RATINGS)[number]['key'];
