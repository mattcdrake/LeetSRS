import { z } from 'zod';
import { storage } from '#imports';
import { cardSchema, fsrsCardSchema, noteTextSchema as noteText } from '@/domain/schemas/v4';
import { type Output as Input, validateOutput as validatePreviousOutput } from './003-remove-day-start';
import { readDataset } from './layouts/v0';
import type { Migration } from './migration';

// Preserve fields that later migrations may need, including nested FSRS fields.
const cardV4Schema = z.looseObject({
  ...cardSchema.shape,
  fsrs: z.looseObject(fsrsCardSchema.shape),
});

export interface Output extends Input {
  cards?: Record<string, z.infer<typeof cardV4Schema>>;
  notes?: never;
}

interface ValidatedInput extends Input {
  notes?: Record<string, unknown>;
}

function validateInput(data: unknown): asserts data is ValidatedInput {
  validatePreviousOutput(data);
  if (data.notes !== undefined) z.record(z.string(), z.unknown()).parse(data.notes);
}

function parseCards(cards: Input['cards']): NonNullable<Output['cards']> {
  const ids = new Set<string>();
  return Object.fromEntries(
    Object.entries(cards ?? {}).map(([slug, value]) => {
      const card = cardV4Schema.parse(value);
      if (card.slug !== slug) throw new Error(`Card slug does not match key: ${slug}`);
      if (ids.has(card.id)) throw new Error(`Duplicate card ID: ${card.id}`);
      ids.add(card.id);
      return [slug, card];
    })
  );
}

export function validateOutput(data: unknown): asserts data is Output {
  validatePreviousOutput(data);
  if (Object.hasOwn(data, 'notes')) throw new Error('Migration 4 must remove the separate notes field');
  parseCards(data.cards);
}

export const embedNotes = {
  description: 'Store note text on its owning card',
  validateOutput,
  async load(): Promise<Input> {
    const input = await readDataset();
    validateInput(input);
    return input;
  },
  migrate(data: unknown): Output {
    validateInput(data);
    const { notes = {}, ...remaining } = data;
    const cards = Object.fromEntries(
      Object.entries(parseCards(data.cards)).map(([slug, card]) => {
        const legacy = Object.hasOwn(notes, card.id) ? z.object({ text: noteText }).parse(notes[card.id]) : undefined;
        const { note: embedded, ...fields } = card;
        const text = Object.hasOwn(card, 'note') ? noteText.parse(embedded) : legacy?.text;
        return [slug, { ...fields, ...(text ? { note: text } : {}) }];
      })
    );
    const output = { ...remaining, ...(data.cards !== undefined && { cards }) };
    validateOutput(output);
    return output;
  },
  async save(output: Output): Promise<void> {
    validateOutput(output);
    if (output.cards !== undefined) await storage.setItem('local:leetsrs:cards', output.cards);
  },
  async cleanup(input: Input): Promise<void> {
    validateInput(input);
    const notes = input.notes ?? {};
    await storage.removeItems(Object.keys(notes).map((id) => `local:leetsrs:notes:${id}` as const));
  },
} satisfies Migration<Input, Output>;
