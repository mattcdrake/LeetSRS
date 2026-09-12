import { storage } from '#imports';
import {
  convert,
  type Input,
  type Output,
  validateInput,
  validateOutput,
} from '../document-conversions/004-embed-notes';
import { readDataset } from './layouts/v0';
import type { Migration } from './migration';

export { type Output, validateOutput } from '../document-conversions/004-embed-notes';

export const embedNotes = {
  description: 'Store note text on its owning card',
  validateOutput,
  async load(): Promise<Input> {
    const input = await readDataset();
    validateInput(input);
    return input;
  },
  migrate: convert,
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
