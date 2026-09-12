import { storage } from '#imports';
import {
  convert,
  type Input,
  inputSchema,
  type Output,
  outputSchema,
} from '../document-conversions/001-add-card-domain';
import { assertSchema } from '../document-conversions/schema-utils';
import { readDataset } from './layouts/v0';
import type { Migration } from './migration';

export type { Output } from '../document-conversions/001-add-card-domain';

export function validateOutput(data: unknown): void {
  outputSchema.parse(data);
}

export const addCardDomain = {
  description: 'Add domain field to existing cards, defaulting to leetcode.com',
  validateOutput,
  async load(): Promise<Input> {
    const input = await readDataset();

    assertSchema(inputSchema, input);

    return input;
  },
  migrate: convert,
  async save(output: Output): Promise<void> {
    validateOutput(output);

    if (output.cards !== undefined) {
      await storage.setItem('local:leetsrs:cards', output.cards);
    }
  },
} satisfies Migration<Input, Output>;
