import { z } from 'zod';

// GitHub's OAuth token response, validated by both the auth worker and the extension.
export const githubTokenSchema = z.object({
  access_token: z.string().min(1),
  refresh_token: z.string().min(1),
  expires_in: z.number().positive(),
  refresh_token_expires_in: z.number().positive(),
  token_type: z.literal('bearer'),
  scope: z.string().refine((scope) => scope.split(/[ ,]+/).includes('gist')),
});
