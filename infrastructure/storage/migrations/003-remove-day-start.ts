import { storage } from '#imports';
import { type Output as Input, validateOutput as validatePreviousOutput } from './002-add-system-theme';
import { readDataset } from './layouts/v0';
import type { Migration } from './migration';

interface ValidatedInput extends Input {
  settings?: Record<string, unknown>;
}

export interface Output extends Input {
  settings?: Record<string, unknown> & {
    dayStartHour?: never;
    autoClearLeetcode?: never;
    resetEditorOnEveryProblem?: boolean;
  };
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
  const settings = data.settings;
  const resetEditor =
    settings?.resetEditorOnEveryProblem !== undefined
      ? settings.resetEditorOnEveryProblem
      : settings?.autoClearLeetcode;
  if (resetEditor !== undefined && typeof resetEditor !== 'boolean') {
    throw new Error('Migration 3 editor-reset setting must be a boolean');
  }
}

export function validateOutput(data: unknown): asserts data is Output {
  validateInput(data);
  if (
    data.settings !== undefined &&
    (Object.hasOwn(data.settings, 'dayStartHour') || Object.hasOwn(data.settings, 'autoClearLeetcode'))
  ) {
    throw new Error('Migration 3 must remove retired settings');
  }
}

function transform(data: ValidatedInput) {
  if (data.settings === undefined) return data;
  const { dayStartHour: _retired, autoClearLeetcode, ...settings } = data.settings;
  if (settings.resetEditorOnEveryProblem === undefined && autoClearLeetcode !== undefined) {
    settings.resetEditorOnEveryProblem = autoClearLeetcode;
  }
  return { ...data, settings };
}

export const removeDayStart = {
  description: 'Remove configurable day start and rename the editor-reset setting',
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
    if (output.settings?.resetEditorOnEveryProblem !== undefined) {
      await storage.setItem('sync:leetsrs:resetEditorOnEveryProblem', output.settings.resetEditorOnEveryProblem);
    }
  },
  async cleanup(_input: Input): Promise<void> {
    await storage.removeItems(['sync:leetsrs:dayStartHour', 'sync:leetsrs:autoClearLeetcode']);
  },
} satisfies Migration<Input, Output>;
