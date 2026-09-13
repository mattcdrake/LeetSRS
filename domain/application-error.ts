import { z } from 'zod';

const simpleCodeSchema = z.enum([
  'unexpected',
  'invalid_input',
  'invalid_settings',
  'card_not_found',
  'invalid_backup',
  'gist_token_required',
  'gist_id_required',
  'gist_not_found',
  'gist_backup_missing',
  'github_unauthorized',
  'github_forbidden',
  'github_rate_limited',
  'github_unavailable',
]);

export const applicationFailureSchema = z.union([
  z.object({ code: simpleCodeSchema }),
  z.object({ code: z.literal('note_too_long'), params: z.object({ limit: z.int().nonnegative() }) }),
  z.object({ code: z.literal('unsupported_backup_version'), params: z.object({ version: z.int().nonnegative() }) }),
]);
export type ApplicationFailure = z.infer<typeof applicationFailureSchema>;
export type ApplicationErrorCode = ApplicationFailure['code'];

// Only this allowlisted payload crosses presentation and messaging boundaries.
export class ApplicationError extends Error {
  readonly failure: ApplicationFailure;

  constructor(failure: ApplicationFailure) {
    super(failure.code);
    this.name = 'ApplicationError';
    this.failure = applicationFailureSchema.parse(failure);
  }
}

// Messaging reconstructs errors as Error, so do not rely on instanceof ApplicationError.
export function getApplicationFailure(error: unknown): ApplicationFailure {
  const payload = error instanceof Error && 'failure' in error ? error.failure : error;
  return applicationFailureSchema.safeParse(payload).data ?? { code: 'unexpected' };
}
