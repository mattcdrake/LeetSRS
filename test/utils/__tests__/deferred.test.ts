import { describe, expect, it } from 'vitest';
import { createDeferred } from '../deferred';

describe('createDeferred', () => {
  it('allows a test to resolve the promise', async () => {
    const deferred = createDeferred<string>();

    deferred.resolve('done');

    await expect(deferred.promise).resolves.toBe('done');
  });

  it('allows a test to reject the promise', async () => {
    const deferred = createDeferred<never>();
    const error = new Error('failed');

    deferred.reject(error);

    await expect(deferred.promise).rejects.toBe(error);
  });
});
