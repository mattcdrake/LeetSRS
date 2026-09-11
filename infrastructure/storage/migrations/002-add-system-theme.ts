import { type CardDomainOutput, validateCardDomainOutput } from './001-add-card-domain';
import { readLegacyData } from './legacy-layout';
import type { Migration } from './migration';

type Input = CardDomainOutput;
export type SystemThemeOutput = Input;

export function validateSystemThemeOutput(data: unknown): asserts data is SystemThemeOutput {
  try {
    validateCardDomainOutput(data);
  } catch (cause) {
    throw new Error('Migration 2 requires the output shape of migration 1', { cause });
  }
}

// System theme changed the application default, not the stored logical dataset.
export const addSystemTheme = {
  description: 'Add system theme preference',
  async load(): Promise<Input> {
    const input = await readLegacyData();
    validateSystemThemeOutput(input);
    return input;
  },
  migrate(data: unknown): SystemThemeOutput {
    validateSystemThemeOutput(data);
    return data;
  },
  async save(_output: SystemThemeOutput): Promise<void> {
    // The logical dataset and its physical layout are unchanged.
  },
} satisfies Migration<Input, SystemThemeOutput>;
