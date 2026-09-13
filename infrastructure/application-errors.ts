import { ApplicationError, getApplicationFailure } from '@/domain/application-error';

function httpStatus(error: unknown): number | undefined {
  if (typeof error !== 'object' || error === null || !('status' in error)) return;
  return typeof error.status === 'number' &&
    Number.isInteger(error.status) &&
    error.status >= 100 &&
    error.status <= 599
    ? error.status
    : undefined;
}

// Never log request objects, response bodies, exception messages, or credentials.
export function reportApplicationError(operation: string, error: unknown) {
  console.error('Application operation failed', {
    operation,
    ...getApplicationFailure(error),
    status: httpStatus(error),
  });
}

export function githubFailure(error: unknown) {
  const known = getApplicationFailure(error);
  if (known.code !== 'unexpected') return known;
  const status = httpStatus(error);
  if (status === 401) return { code: 'github_unauthorized' } as const;
  if (status === 404) return { code: 'gist_not_found' } as const;
  if (status === 429) return { code: 'github_rate_limited' } as const;
  if (status === 403) {
    const headers =
      typeof error === 'object' &&
      error !== null &&
      'response' in error &&
      typeof error.response === 'object' &&
      error.response !== null &&
      'headers' in error.response
        ? error.response.headers
        : undefined;
    const rateLimited =
      typeof headers === 'object' &&
      headers !== null &&
      (('x-ratelimit-remaining' in headers && String(headers['x-ratelimit-remaining']) === '0') ||
        'retry-after' in headers);
    return { code: rateLimited ? 'github_rate_limited' : 'github_forbidden' } as const;
  }
  if (status !== undefined && status >= 500) return { code: 'github_unavailable' } as const;
  return known;
}

export function safeApplicationError(operation: string, error: unknown): ApplicationError {
  reportApplicationError(operation, error);
  return new ApplicationError(getApplicationFailure(error));
}
