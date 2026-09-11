import { type Output as Input, validateOutput as validatePreviousOutput } from './001-add-card-domain';
import { readDataset } from './layouts/v0';
import type { Migration } from './migration';

export type Output = Input;

function validateInput(data: unknown): asserts data is Input {
  try {
    validatePreviousOutput(data);
  } catch (cause) {
    throw new Error('Migration 2 requires the output shape of migration 1', { cause });
  }
}

export const validateOutput: typeof validateInput = validateInput;

// System theme changed the application default, not the stored logical dataset.
export const addSystemTheme = {
  description: 'Add system theme preference',
  async load(): Promise<Input> {
    const input = await readDataset();
    validateInput(input);
    return input;
  },
  migrate(data: unknown): Output {
    validateInput(data);
    return data;
  },
  async save(_output: Output): Promise<void> {
    // The logical dataset and its physical layout are unchanged.
  },
} satisfies Migration<Input, Output>;
