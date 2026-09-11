import { Octokit } from 'octokit';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fakeBrowser } from 'wxt/testing/fake-browser';
import { storage } from 'wxt/utils/storage';
import { setGistSyncConfig } from '@/services/gist-setup';
import { validatePat } from '../github-auth';

const { getAuthenticated, getGist } = vi.hoisted(() => ({
  getAuthenticated: vi.fn(),
  getGist: vi.fn(),
}));

vi.mock('octokit', () => ({
  Octokit: vi.fn(function MockOctokit() {
    return {
      rest: {
        users: { getAuthenticated },
        gists: { get: getGist },
      },
    };
  }),
}));

describe('github-auth', () => {
  beforeEach(() => {
    fakeBrowser.reset();
    fakeBrowser.runtime.id = 'test';
  });

  describe('validatePat', () => {
    it.each(['', ' \t\n'])('rejects blank input %j without storage access or requests', async (pat) => {
      const reads = vi.spyOn(storage, 'getItem');
      const writes = vi.spyOn(storage, 'setItem');

      expect(await validatePat(pat)).toEqual({ valid: false, error: 'PAT is required' });
      expect(Octokit).not.toHaveBeenCalled();
      expect(getAuthenticated).not.toHaveBeenCalled();
      expect(reads).not.toHaveBeenCalled();
      expect(writes).not.toHaveBeenCalled();
    });

    it('validates the untrimmed input and returns the username without accessing stored credentials', async () => {
      await setGistSyncConfig({ pat: 'stored' });
      const reads = vi.spyOn(storage, 'getItem');
      const writes = vi.spyOn(storage, 'setItem');
      getAuthenticated.mockResolvedValue({ data: { login: 'testuser' } });

      expect(await validatePat(' token ')).toEqual({ valid: true, username: 'testuser' });
      expect(Octokit).toHaveBeenCalledExactlyOnceWith({ auth: ' token ' });
      expect(getAuthenticated).toHaveBeenCalledExactlyOnceWith();
      expect(reads).not.toHaveBeenCalled();
      expect(writes).not.toHaveBeenCalled();
    });

    it.each([
      [new Error('401 Unauthorized'), 'Invalid token'],
      [new Error('403 Forbidden'), 'Token lacks required permissions (needs gist scope)'],
      [new Error('Network error'), 'Network error'],
      ['string error', 'Unknown error validating token'],
    ])('preserves validation error handling for %j', async (failure, error) => {
      const writes = vi.spyOn(storage, 'setItem');
      getAuthenticated.mockRejectedValue(failure);

      expect(await validatePat('token')).toEqual({ valid: false, error });
      expect(writes).not.toHaveBeenCalled();
    });

    it('returns client-construction failures as validation errors', async () => {
      vi.mocked(Octokit).mockImplementationOnce(function FailingOctokit() {
        throw new Error('client failed');
      });

      expect(await validatePat('token')).toEqual({ valid: false, error: 'client failed' });
      expect(getAuthenticated).not.toHaveBeenCalled();
    });
  });
});
