import type { CardInput } from 'ts-fsrs';
import type { z } from 'zod';
import { ratingSchema } from './ratings';
import {
  cardSchema as cardV4Schema,
  difficultySchema,
  fsrsCardSchema as fsrsCardV4Schema,
  leetcodeDomainSchema,
  problemDescriptorSchema,
} from './schemas/v4';

export { difficultySchema, leetcodeDomainSchema, problemDescriptorSchema };
export type Difficulty = z.infer<typeof difficultySchema>;
export type LeetcodeDomain = z.infer<typeof leetcodeDomainSchema>;
export type ProblemDescriptor = z.infer<typeof problemDescriptorSchema>;

export const rateCardInputSchema = problemDescriptorSchema.extend({ rating: ratingSchema });
export type RateCardInput = z.infer<typeof rateCardInputSchema>;

export const fsrsCardSchema = fsrsCardV4Schema satisfies z.ZodType<CardInput>;
export type FsrsCard = z.infer<typeof fsrsCardSchema>;

export const cardSchema = cardV4Schema.transform((card) => {
  if (card.note === '') delete card.note;
  return card;
});
export type Card = z.infer<typeof cardSchema>;
