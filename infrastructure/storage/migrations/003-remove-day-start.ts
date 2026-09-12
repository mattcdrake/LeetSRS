import { storage } from '#imports';
import {
  convert,
  type Input,
  type Output,
  validateInput,
  validateOutput,
} from '../document-conversions/003-remove-day-start';
import { readDataset } from './layouts/v0';
import type { Migration } from './migration';

export { type Output, validateOutput } from '../document-conversions/003-remove-day-start';

export const removeDayStart = {
  description: 'Remove configurable day start and rename the editor-reset setting',
  validateOutput,
  async load(): Promise<Input> {
    const input = await readDataset();
    validateInput(input);
    return input;
  },
  migrate: convert,
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
