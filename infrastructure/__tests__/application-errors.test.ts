import { expect, it, vi } from 'vitest';
import { ApplicationError } from '@/domain/application-error';
import { githubFailure, reportApplicationError, safeApplicationError } from '../application-errors';

it.each([
  [401, {}, 'github_unauthorized'],
  [403, {}, 'github_forbidden'],
  [403, { 'x-ratelimit-remaining': '0' }, 'github_rate_limited'],
  [403, { 'retry-after': '60' }, 'github_rate_limited'],
  [404, {}, 'gist_not_found'],
  [429, {}, 'github_rate_limited'],
  [503, {}, 'github_unavailable'],
] as const)('classifies HTTP %s with headers %j without parsing response text', (status, headers, code) => {
  const error = Object.assign(new Error('secret remote response'), { status, response: { headers } });
  expect(githubFailure(error)).toEqual({ code });
});

it('does not interpret arbitrary exception text as a GitHub error', () => {
  expect(githubFailure(new Error('404 403 rate limit'))).toEqual({ code: 'unexpected' });
  expect(githubFailure(new ApplicationError({ code: 'invalid_backup' }))).toEqual({ code: 'invalid_backup' });
});

it('keeps operation, safe code and HTTP status without logging or forwarding sensitive fields', () => {
  const log = vi.spyOn(console, 'error').mockImplementation(() => {});
  const error = Object.assign(new Error('ghp_secret and private response body'), {
    status: 500,
    request: { headers: { authorization: 'token ghp_secret' } },
    response: { data: 'private response body' },
  });
  reportApplicationError('setupGistSync', error);
  const safe = safeApplicationError('setupGistSync', error);
  expect(log).toHaveBeenCalledWith('Application operation failed', {
    operation: 'setupGistSync',
    code: 'unexpected',
    status: 500,
  });
  expect(JSON.stringify(log.mock.calls)).not.toMatch(/ghp_secret|private response|authorization/);
  expect(safe.failure).toEqual({ code: 'unexpected' });
  expect(safe.cause).toBeUndefined();
  expect(JSON.stringify(safe)).not.toMatch(/ghp_secret|private response|authorization/);
});
