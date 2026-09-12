import { type Output as Input, validateOutput as validatePreviousOutput } from './001-add-card-domain';

export type Output = Input;

export function validateInput(data: unknown): asserts data is Input {
  try {
    validatePreviousOutput(data);
  } catch (cause) {
    throw new Error('Migration 2 requires the output shape of migration 1', { cause });
  }
}

export const validateOutput: typeof validateInput = validateInput;

// System theme changed the application default, not the stored logical dataset.

export type { Input };
export function convert(data: unknown): Output {
  validateInput(data);
  return data;
}
