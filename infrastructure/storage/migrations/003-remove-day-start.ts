import { storage } from '#imports';
import { type SystemThemeOutput, validateSystemThemeOutput } from './002-add-system-theme';
import { readLegacyData } from './legacy-layout';
import type { Migration } from './migration';

type Input = SystemThemeOutput;

interface ValidatedInput extends Input {
  settings?: Record<string, unknown>;
}

export interface RemoveDayStartOutput extends Input {
  settings?: Record<string, unknown> & { dayStartHour?: never };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function validateInput(data: unknown): asserts data is ValidatedInput {
  try {
    validateSystemThemeOutput(data);
  } catch (cause) {
    throw new Error('Migration 3 requires the output shape of migration 2', { cause });
  }
  // Reject malformed settings containers; all unrelated records remain untouched.
  if (!isRecord(data) || (data.settings !== undefined && !isRecord(data.settings))) {
    throw new Error('Migration 3 requires a dataset with an optional settings object');
  }
}

function validateOutput(data: RemoveDayStartOutput): void {
  validateInput(data);
  if (data.settings !== undefined && Object.hasOwn(data.settings, 'dayStartHour')) {
    throw new Error('Migration 3 must remove dayStartHour');
  }
}

function transform(data: ValidatedInput): RemoveDayStartOutput {
  if (data.settings === undefined) return data;
  const { dayStartHour: _retired, ...settings } = data.settings;
  return { ...data, settings };
}

export const removeDayStart = {
  description: 'Remove configurable day start',
  async load(): Promise<Input> {
    const input = await readLegacyData();
    validateInput(input);
    return input;
  },
  migrate(data: unknown): RemoveDayStartOutput {
    validateInput(data);
    const output = transform(data);
    validateOutput(output);
    return output;
  },
  async save(output: RemoveDayStartOutput): Promise<void> {
    validateOutput(output);
    // Retiring the setting requires only source cleanup, not destination writes.
  },
  async cleanup(_input: Input): Promise<void> {
    await storage.removeItems(['sync:leetsrs:dayStartHour']);
  },
} satisfies Migration<Input, RemoveDayStartOutput>;
