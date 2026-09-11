import type { CardInput } from 'ts-fsrs';
import { z } from 'zod';
import { noteTextSchema } from './notes';
import { ratingSchema } from './ratings';

const nonemptyString = z.string().refine((value) => value.trim().length > 0, {
  message: 'Must contain at least one non-whitespace character',
});
const count = z.int().nonnegative();
const epochMilliseconds = z.number().min(-8.64e15).max(8.64e15);

export const difficultySchema = z.enum(['Easy', 'Medium', 'Hard']);
export const leetcodeDomainSchema = z.enum(['leetcode.com', 'leetcode.cn']);
export const problemDescriptorSchema = z.object({
  slug: nonemptyString,
  name: nonemptyString,
  leetcodeId: nonemptyString,
  difficulty: difficultySchema,
  domain: leetcodeDomainSchema,
});

export const fsrsCardSchema = z.object({
  due: epochMilliseconds,
  last_review: epochMilliseconds.optional(),
  state: z.union([z.literal(0), z.literal(1), z.literal(2), z.literal(3)]),
  stability: z.number().nonnegative(),
  difficulty: z.number().nonnegative(),
  elapsed_days: z.number().nonnegative(),
  scheduled_days: z.number().nonnegative(),
  reps: count,
  lapses: count,
  learning_steps: count,
}) satisfies z.ZodType<CardInput>;

export const cardSchema = problemDescriptorSchema
  .extend({
    id: nonemptyString,
    createdAt: epochMilliseconds,
    fsrs: fsrsCardSchema,
    paused: z.boolean(),
    note: noteTextSchema.optional(),
  })
  .transform((card) => {
    if (card.note === '') delete card.note;
    return card;
  });

export type Difficulty = z.infer<typeof difficultySchema>;
export type LeetcodeDomain = z.infer<typeof leetcodeDomainSchema>;
export type ProblemDescriptor = z.infer<typeof problemDescriptorSchema>;
export const rateCardInputSchema = problemDescriptorSchema.extend({ rating: ratingSchema });
export type RateCardInput = z.infer<typeof rateCardInputSchema>;
export type FsrsCard = z.infer<typeof fsrsCardSchema>;
export type Card = z.infer<typeof cardSchema>;
