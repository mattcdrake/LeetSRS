import { storage } from '#imports';
import {
  convert,
  type Input,
  type Output,
  validateInput,
  validateOutput,
} from '../document-conversions/001-add-card-domain';
import { readDataset } from './layouts/v0';
import type { Migration } from './migration';

export { type Output, validateOutput } from '../document-conversions/001-add-card-domain';

export const addCardDomain = {
  description: 'Add domain field to existing cards, defaulting to leetcode.com',
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
} satisfies Migration<Input, Output>;
