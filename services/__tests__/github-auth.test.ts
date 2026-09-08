import { Octokit } from 'octokit';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fakeBrowser } from 'wxt/testing/fake-browser';
import { storage } from 'wxt/utils/storage';
import { STORAGE_KEYS } from '@/infrastructure/storage/storage-keys';
import {
  getAuthenticatedGitHubClient,
  getGitHubPat,
  hasGitHubCredentials,
  removeGitHubPat,
  setGitHubPat,
  validatePat,
} from '../github-auth';

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

  it.each(['', ' token '])('persists and removes credential %j without marking local edits', async (pat) => {
    expect(await getGitHubPat()).toBeNull();
    await setGitHubPat(pat);
    expect(await storage.getItem(STORAGE_KEYS.githubPat)).toBe(pat);
    expect(await getGitHubPat()).toBe(pat);

    await removeGitHubPat();
    expect(await storage.getItem(STORAGE_KEYS.githubPat)).toBeNull();
    expect(await storage.getItem(STORAGE_KEYS.dataUpdatedAt)).toBeNull();
    expect(Octokit).not.toHaveBeenCalled();
  });

  it.each([
    { pat: null, ready: false },
    { pat: '', ready: false },
    { pat: '   ', ready: true },
    { pat: ' token ', ready: true },
  ])('reports readiness and acquires a client for stored credential $pat', async ({ pat, ready }) => {
    if (pat !== null) await storage.setItem(STORAGE_KEYS.githubPat, pat);

    expect(await hasGitHubCredentials()).toBe(ready);
    expect(Octokit).not.toHaveBeenCalled();

    const client = await getAuthenticatedGitHubClient();
    if (ready) {
      expect(client).not.toBeNull();
      expect(Octokit).toHaveBeenCalledExactlyOnceWith({ auth: pat });
    } else {
      expect(client).toBeNull();
      expect(Octokit).not.toHaveBeenCalled();
    }
    expect(getAuthenticated).not.toHaveBeenCalled();
  });

  it.each([' supplied ', '', '   '])('uses supplied credential %j without reading or writing storage', async (pat) => {
    await storage.setItem(STORAGE_KEYS.githubPat, 'stored');
    const reads = vi.spyOn(storage, 'getItem');
    const writes = vi.spyOn(storage, 'setItem');
    const client = await getAuthenticatedGitHubClient(pat);
    await client.getGist('gist');

    expect(Octokit).toHaveBeenCalledExactlyOnceWith({ auth: pat });
    expect(getGist).toHaveBeenCalledExactlyOnceWith({ gist_id: 'gist' });
    expect(getAuthenticated).not.toHaveBeenCalled();
    expect(reads).not.toHaveBeenCalled();
    expect(writes).not.toHaveBeenCalled();
  });

  it('propagates credential persistence failures', async () => {
    const failure = new Error('storage unavailable');
    vi.spyOn(storage, 'getItem').mockRejectedValue(failure);
    vi.spyOn(storage, 'setItem').mockRejectedValue(failure);
    vi.spyOn(storage, 'removeItem').mockRejectedValue(failure);

    await expect(getGitHubPat()).rejects.toBe(failure);
    await expect(hasGitHubCredentials()).rejects.toBe(failure);
    await expect(getAuthenticatedGitHubClient()).rejects.toBe(failure);
    await expect(setGitHubPat('token')).rejects.toBe(failure);
    await expect(removeGitHubPat()).rejects.toBe(failure);
    expect(Octokit).not.toHaveBeenCalled();
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
      await storage.setItem(STORAGE_KEYS.githubPat, 'stored');
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
