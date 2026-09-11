import { z } from 'zod';
export const NOTES_MAX_LENGTH = 500;
export const noteTextSchema = z.string().max(NOTES_MAX_LENGTH, {
  error: `Note exceeds maximum length of ${NOTES_MAX_LENGTH} characters`,
});

export const noteSchema = z.object({
  text: noteTextSchema,
});
export type Note = z.infer<typeof noteSchema>;
