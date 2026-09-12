import { z } from 'zod';
import { type Output as Input, validateOutput as validatePreviousOutput } from './003-remove-day-start';

// Frozen version 4 contract; changes to current domain schemas must not alter this migration.
const nonemptyString = z.string().refine((value) => value.trim().length > 0, {
  message: 'Must contain at least one non-whitespace character',
});
const count = z.int().nonnegative();
const epochMilliseconds = z.number().min(-8.64e15).max(8.64e15);

const NOTES_MAX_LENGTH = 500;
const noteText = z.string().max(NOTES_MAX_LENGTH, {
  error: `Note exceeds maximum length of ${NOTES_MAX_LENGTH} characters`,
});

const difficultySchema = z.enum(['Easy', 'Medium', 'Hard']);
const leetcodeDomainSchema = z.enum(['leetcode.com', 'leetcode.cn']);
const problemDescriptorSchema = z.object({
  slug: nonemptyString,
  name: nonemptyString,
  leetcodeId: nonemptyString,
  difficulty: difficultySchema,
  domain: leetcodeDomainSchema,
});

const fsrsCardSchema = z.object({
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

const cardSchema = problemDescriptorSchema.extend({
  id: nonemptyString,
  createdAt: epochMilliseconds,
  fsrs: fsrsCardSchema,
  paused: z.boolean(),
  note: noteText.optional(),
});

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

export function validateInput(data: unknown): asserts data is ValidatedInput {
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

export type { Input };
export function convert(data: unknown): Output {
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
}
