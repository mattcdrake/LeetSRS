import { z } from 'zod';
import { storage } from '#imports';
import { gistConnectionSchema } from '@/domain/schemas/v5';
import { type Output as Input, validateOutput as validateInput } from './004-embed-notes';
import { readDataset } from './layouts/v4';
import type { Migration } from './migration';

export type Output = Input;
export const validateOutput: typeof validateInput = validateInput;

export const localGistConnection = {
  description: 'Move the Gist connection to one device-local record',
  validateOutput,
  async load(): Promise<Input> {
    const input = await readDataset();
    validateInput(input);
    return input;
  },
  migrate(data: unknown): Output {
    validateInput(data);
    return data;
  },
  async save(output: Output): Promise<void> {
    validateOutput(output);
    // A prior attempt may have saved the destination before recording completion.
    // Prefer it even if another device has since changed the legacy sync keys.
    let connection = output.gistConnection;
    if (connection == null) {
      const destination = z
        .object({ gistId: z.string().nullish(), enabled: z.boolean().nullish() })
        .parse(output.gistSync ?? {});
      connection = {
        pat: output.settings?.githubPat ?? '',
        gistId: destination.gistId ?? null,
        enabled: destination.enabled ?? false,
      };
    }
    const validated = gistConnectionSchema.parse(connection);
    await storage.setItem('local:leetsrs:gistConnection', validated);
    // Keep legacy sync keys for devices that have not upgraded yet.
  },
} satisfies Migration<Input, Output>;
