import { z } from 'zod';
import { noteTextSchema } from './schemas/v4';

export { NOTES_MAX_LENGTH } from './schemas/v4';

export const noteSchema = z.object({
  text: noteTextSchema,
});
export type Note = z.infer<typeof noteSchema>;
