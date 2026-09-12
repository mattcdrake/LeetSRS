import type { z } from 'zod';
import { assertSchema } from './schema-utils';
import {
  datasetV3Schema as inputSchema,
  legacyNoteSchema,
  noteTextSchema,
  datasetV4Schema as outputSchema,
} from './schemas';

export { inputSchema, outputSchema };
export type Input = z.infer<typeof inputSchema>;
export type Output = z.infer<typeof outputSchema>;

export function convert(data: unknown): Output {
  assertSchema(inputSchema, data);
  const { notes = {}, ...remaining } = data;
  const cards = Object.fromEntries(
    Object.entries(data.cards ?? {}).map(([slug, card]) => {
      const legacy = Object.hasOwn(notes, card.id) ? legacyNoteSchema.parse(notes[card.id]) : undefined;
      const { note: embedded, ...fields } = card;
      const text = Object.hasOwn(card, 'note') ? noteTextSchema.parse(embedded) : legacy?.text;
      return [slug, { ...fields, ...(text ? { note: text } : {}) }];
    })
  );
  const output = { ...remaining, ...(data.cards !== undefined && { cards }) };
  assertSchema(outputSchema, output);
  return output;
}
