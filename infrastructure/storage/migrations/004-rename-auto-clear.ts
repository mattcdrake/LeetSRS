import { storage } from '#imports';
import { type Output as Input, validateOutput as validatePreviousOutput } from './003-remove-day-start';
import { readDataset } from './layouts/v0';
import type { Migration } from './migration';

export interface Output extends Input {
  settings?: NonNullable<Input['settings']> & { autoClearLeetcode?: never; resetEditorOnEveryProblem?: boolean };
}

function validateInput(data: unknown): asserts data is Input {
  try {
    validatePreviousOutput(data);
  } catch (cause) {
    throw new Error('Migration 4 requires the output shape of migration 3', { cause });
  }
  const settings = data.settings;
  // The current setting takes precedence, including invalid explicit values.
  const selected =
    settings?.resetEditorOnEveryProblem !== undefined
      ? settings.resetEditorOnEveryProblem
      : settings?.autoClearLeetcode;
  if (selected !== undefined && typeof selected !== 'boolean') {
    throw new Error('Migration 4 requires a boolean reset-editor setting');
  }
}

export function validateOutput(data: unknown): asserts data is Output {
  validateInput(data);
  if (data.settings !== undefined && Object.hasOwn(data.settings, 'autoClearLeetcode')) {
    throw new Error('Migration 4 must remove autoClearLeetcode');
  }
}

export const renameAutoClear = {
  description: 'Rename autoClearLeetcode to resetEditorOnEveryProblem',
  async load(): Promise<Input> {
    const input = await readDataset();
    validateInput(input);
    return input;
  },
  migrate(data: unknown): Output {
    validateInput(data);
    if (data.settings === undefined) return data;
    const { autoClearLeetcode, ...settings } = data.settings;
    if (settings.resetEditorOnEveryProblem === undefined && autoClearLeetcode !== undefined) {
      settings.resetEditorOnEveryProblem = autoClearLeetcode;
    }
    const output = { ...data, settings };
    validateOutput(output);
    return output;
  },
  async save(output: Output): Promise<void> {
    validateOutput(output);
    if (output.settings?.resetEditorOnEveryProblem !== undefined) {
      // The logical setting was renamed; its physical storage key remains unchanged.
      await storage.setItem('sync:leetsrs:autoClearLeetcode', output.settings.resetEditorOnEveryProblem);
    }
  },
} satisfies Migration<Input, Output>;
