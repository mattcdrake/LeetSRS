import { z } from 'zod';
import { storage } from '#imports';
import { type Output as Input, validateOutput as validateInput } from './004-embed-notes';
import { readDataset } from './layouts/v4';
import type { Migration } from './migration';

// Frozen installed connection contract introduced by migration 5.
const gistConnectionSchema = z.object({
  pat: z.string(),
  gistId: z.string().nullable(),
  enabled: z.boolean(),
});

export type Output = Input;
export const validateOutput: typeof validateInput = validateInput;

// Only the installed representation changes. Backup transformations stay pure
// and leave their existing Gist configuration (which excludes the PAT) alone.
export const combineGistConnection = {
  description: 'Combine the browser-synced Gist connection',
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
    const settings = output.settings ?? {};
    if (Object.hasOwn(settings, 'gistConnection')) {
      gistConnectionSchema.parse(settings.gistConnection);
      return;
    }
    const destination = gistConnectionSchema
      .omit({ pat: true })
      .partial()
      .parse(output.gistSync ?? {});
    const connection = gistConnectionSchema.parse({
      pat: settings.githubPat ?? '',
      gistId: destination.gistId ?? null,
      enabled: destination.enabled ?? false,
    });
    await storage.setItem('sync:leetsrs:gistConnection', connection);
    // Retain legacy keys for browsers that have not upgraded. There are no dual writes.
  },
} satisfies Migration<Input, Output>;
