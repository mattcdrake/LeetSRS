import { z } from 'zod';
import { legacyNoteSchema, noteTextSchema } from './001-add-card-domain';
import { outputSchema as inputSchema } from './003-remove-day-start';
import { assertSchema } from './schema-utils';

export { inputSchema };

export const outputSchema = inputSchema
  .safeExtend({
    notes: z.never({ error: 'Migration 4 must remove the separate notes field' }).optional(),
  })
  .superRefine((data, ctx) => {
    if (Object.hasOwn(data, 'notes')) {
      ctx.addIssue({ code: 'custom', path: ['notes'], message: 'Migration 4 must remove the separate notes field' });
    }
  });

export type Input = z.infer<typeof inputSchema>;
export type Output = z.infer<typeof outputSchema>;

export function convert(data: unknown): Output {
  assertSchema(inputSchema, data);

  const { notes = {}, ...remaining } = data;
  const output = { ...remaining };

  if (data.cards !== undefined) {
    output.cards = Object.fromEntries(
      Object.entries(data.cards).map(([slug, card]) => {
        const legacyNote = Object.hasOwn(notes, card.id) ? legacyNoteSchema.parse(notes[card.id]) : undefined;
        const { note: embeddedNote, ...cardWithoutNote } = card;
        let note = legacyNote?.text;

        if (Object.hasOwn(card, 'note')) {
          note = noteTextSchema.parse(embeddedNote);
        }

        if (note) {
          return [slug, { ...cardWithoutNote, note }];
        }

        return [slug, cardWithoutNote];
      })
    );
  }

  assertSchema(outputSchema, output);

  return output;
}
