import {
  convert,
  type Input,
  inputSchema,
  type Output,
  outputSchema,
} from '../document-conversions/002-add-system-theme';
import { assertSchema } from '../document-conversions/schema-utils';
import { readDataset } from './layouts/v0';
import type { Migration } from './migration';

export type { Output } from '../document-conversions/002-add-system-theme';

export function validateOutput(data: unknown): void {
  outputSchema.parse(data);
}

export const addSystemTheme = {
  description: 'Add system theme preference',
  validateOutput,
  async load(): Promise<Input> {
    const input = await readDataset();

    assertSchema(inputSchema, input);

    return input;
  },
  migrate: convert,
  async save(_output: Output): Promise<void> {
    // The logical dataset and its physical layout are unchanged.
  },
} satisfies Migration<Input, Output>;
