import { storage } from '#imports';
import { type Output as Input, validateOutput as validatePreviousOutput } from './002-add-system-theme';
import { readDataset } from './layouts/v0';
import type { Migration } from './migration';

interface ValidatedInput extends Input {
  settings?: Record<string, unknown>;
}

export interface Output extends Input {
  settings?: Record<string, unknown> & { dayStartHour?: never };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function validateInput(data: unknown): asserts data is ValidatedInput {
  try {
    validatePreviousOutput(data);
  } catch (cause) {
    throw new Error('Migration 3 requires the output shape of migration 2', { cause });
  }
  // Reject malformed settings containers; all unrelated records remain untouched.
  if (!isRecord(data) || (data.settings !== undefined && !isRecord(data.settings))) {
    throw new Error('Migration 3 requires a dataset with an optional settings object');
  }
}

export function validateOutput(data: unknown): asserts data is Output {
  validateInput(data);
  if (data.settings !== undefined && Object.hasOwn(data.settings, 'dayStartHour')) {
    throw new Error('Migration 3 must remove dayStartHour');
  }
}

function transform(data: ValidatedInput): Output {
  if (data.settings === undefined) return data;
  const { dayStartHour: _retired, ...settings } = data.settings;
  return { ...data, settings };
}

export const removeDayStart = {
  description: 'Remove configurable day start',
  async load(): Promise<Input> {
    const input = await readDataset();
    validateInput(input);
    return input;
  },
  migrate(data: unknown): Output {
    validateInput(data);
    const output = transform(data);
    validateOutput(output);
    return output;
  },
  async save(output: Output): Promise<void> {
    validateOutput(output);
    // Retiring the setting requires only source cleanup, not destination writes.
  },
  async cleanup(_input: Input): Promise<void> {
    await storage.removeItems(['sync:leetsrs:dayStartHour']);
  },
} satisfies Migration<Input, Output>;
