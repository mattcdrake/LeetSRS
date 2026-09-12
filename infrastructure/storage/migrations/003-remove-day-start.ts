import { storage } from '#imports';
import {
  convert,
  type Input,
  inputSchema,
  type Output,
  outputSchema,
} from '../document-conversions/003-remove-day-start';
import { assertSchema } from '../document-conversions/schema-utils';
import { readDataset } from './layouts/v0';
import type { Migration } from './migration';

export type { Output } from '../document-conversions/003-remove-day-start';

export function validateOutput(data: unknown): void {
  outputSchema.parse(data);
}

export const removeDayStart = {
  description: 'Remove configurable day start and rename the editor-reset setting',
  validateOutput,
  async load(): Promise<Input> {
    const input = await readDataset();
    assertSchema(inputSchema, input);
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
