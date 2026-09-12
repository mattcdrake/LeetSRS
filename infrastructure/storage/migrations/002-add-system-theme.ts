import {
  convert,
  type Input,
  type Output,
  validateInput,
  validateOutput,
} from '../document-conversions/002-add-system-theme';
import { readDataset } from './layouts/v0';
import type { Migration } from './migration';

export { type Output, validateOutput } from '../document-conversions/002-add-system-theme';

export const addSystemTheme = {
  description: 'Add system theme preference',
  validateOutput,
  async load(): Promise<Input> {
    const input = await readDataset();
    validateInput(input);
    return input;
  },
  migrate: convert,
  async save(_output: Output): Promise<void> {
    // The logical dataset and its physical layout are unchanged.
  },
} satisfies Migration<Input, Output>;
