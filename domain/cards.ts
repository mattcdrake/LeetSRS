import { z } from 'zod';
import { ratingSchema } from './ratings';
import { scheduleSchema } from './scheduling';

export const NOTES_MAX_LENGTH = 500;
export const noteTextSchema = z.string().max(NOTES_MAX_LENGTH, {
  error: `Note exceeds maximum length of ${NOTES_MAX_LENGTH} characters`,
});

const nonemptyString = z.string().refine((value) => value.trim().length > 0, {
  message: 'Must contain at least one non-whitespace character',
});
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

export const cardSchema = problemDescriptorSchema
  .extend({
    id: nonemptyString,
    createdAt: epochMilliseconds,
    fsrs: scheduleSchema,
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
export type Card = z.infer<typeof cardSchema>;
