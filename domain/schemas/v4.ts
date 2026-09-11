import { z } from 'zod';

// Shared version 4 field definitions. Keep this contract fixed when newer versions
// change; those versions can reuse or extend these schemas.
const nonemptyString = z.string().refine((value) => value.trim().length > 0, {
  message: 'Must contain at least one non-whitespace character',
});
const count = z.int().nonnegative();
const epochMilliseconds = z.number().min(-8.64e15).max(8.64e15);

export const NOTES_MAX_LENGTH = 500;
export const noteTextSchema = z.string().max(NOTES_MAX_LENGTH, {
  error: `Note exceeds maximum length of ${NOTES_MAX_LENGTH} characters`,
});

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
});

export const cardSchema = problemDescriptorSchema.extend({
  id: nonemptyString,
  createdAt: epochMilliseconds,
  fsrs: fsrsCardSchema,
  paused: z.boolean(),
  note: noteTextSchema.optional(),
});
