import { z } from 'zod';

export function assertSchema<T>(schema: z.ZodType<T>, value: unknown): asserts value is T {
  // Validate without replacing the original: historical extras must survive until conversion.
  schema.parse(value);
}

export function recordSchema<T>(valueSchema: z.ZodType<T>) {
  // Zod's record parser skips __proto__. Entries preserve and validate every legal JSON key.
  return z.preprocess(
    (value, ctx) => {
      if (typeof value !== 'object' || value === null || Array.isArray(value)) {
        ctx.addIssue({ code: 'custom', message: 'Expected a record object' });
        return z.NEVER;
      }

      return Object.entries(value);
    },
    z.array(z.tuple([z.string(), valueSchema])).transform((entries) => Object.fromEntries<T>(entries))
  );
}
