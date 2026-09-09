import { type CardInput, State } from 'ts-fsrs';
import { z } from 'zod';
import { ratingSchema } from './ratings';

const nonemptyString = z.string().refine((value) => value.trim().length > 0, {
  message: 'Must contain at least one non-whitespace character',
});
const count = z.int().nonnegative();
const epochMilliseconds = z.number().min(-8.64e15).max(8.64e15);

export const difficultySchema = z.enum(['Easy', 'Medium', 'Hard']);
export type Difficulty = z.infer<typeof difficultySchema>;

export const leetcodeDomainSchema = z.enum(['leetcode.com', 'leetcode.cn']);
export type LeetcodeDomain = z.infer<typeof leetcodeDomainSchema>;

export const problemDescriptorSchema = z.object({
  slug: nonemptyString,
  name: nonemptyString,
  leetcodeId: nonemptyString,
  difficulty: difficultySchema,
  domain: leetcodeDomainSchema,
});
export type ProblemDescriptor = z.infer<typeof problemDescriptorSchema>;

export const rateCardInputSchema = problemDescriptorSchema.extend({ rating: ratingSchema });
export type RateCardInput = z.infer<typeof rateCardInputSchema>;

export const fsrsCardSchema = z.object({
  due: epochMilliseconds,
  last_review: epochMilliseconds.optional(),
  state: z.enum(State),
  stability: z.number().nonnegative(),
  difficulty: z.number().nonnegative(),
  elapsed_days: z.number().nonnegative(),
  scheduled_days: z.number().nonnegative(),
  reps: count,
  lapses: count,
  learning_steps: count,
}) satisfies z.ZodType<CardInput>;
export type FsrsCard = z.infer<typeof fsrsCardSchema>;

export const cardSchema = problemDescriptorSchema.extend({
  id: nonemptyString,
  createdAt: epochMilliseconds,
  fsrs: fsrsCardSchema,
  paused: z.boolean(),
});
export type Card = z.infer<typeof cardSchema>;
