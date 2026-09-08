import { Octokit } from 'octokit';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fakeBrowser } from 'wxt/testing/fake-browser';
import { storage } from 'wxt/utils/storage';
import { createGitHubClient } from '@/infrastructure/github/client';
import { STORAGE_KEYS } from '@/infrastructure/storage/storage-keys';
import {
  createGist,
  createNewGist,
  getGistDestinationConfig,
  setGistSyncConfig,
  validateGist,
  validateGistId,
} from '../gist-setup';
import * as auth from '../github-auth';

const { getGist, create, getAuthenticated, exportData } = vi.hoisted(() => ({
  getGist: vi.fn(),
  create: vi.fn(),
  getAuthenticated: vi.fn(),
  exportData: vi.fn(),
}));

vi.mock('octokit', () => ({
  Octokit: vi.fn(function MockOctokit() {
    return { rest: { users: { getAuthenticated }, gists: { get: getGist, create } } };
  }),
}));
vi.mock('../import-export', () => ({ exportData }));

describe('gist-setup boundaries', () => {
  beforeEach(() => {
    fakeBrowser.reset();
    fakeBrowser.runtime.id = 'test';
  });

  it('reads destination defaults and saved values without reading credentials', async () => {
    const reads = vi.spyOn(storage, 'getItem');
    expect(await getGistDestinationConfig()).toEqual({ gistId: null, enabled: false });
    await storage.setItem(STORAGE_KEYS.gistId, 'saved');
    await storage.setItem(STORAGE_KEYS.gistSyncEnabled, true);
    expect(await getGistDestinationConfig()).toEqual({ gistId: 'saved', enabled: true });
    expect(reads.mock.calls.map(([key]) => key)).not.toContain(STORAGE_KEYS.githubPat);
  });

  it('writes credentials, destination, and enabled in order', async () => {
    const writes = vi.spyOn(storage, 'setItem');
    await setGistSyncConfig({ pat: ' token ', gistId: 'gist', enabled: true });
    expect(writes.mock.calls).toEqual([
      [STORAGE_KEYS.githubPat, ' token '],
      [STORAGE_KEYS.gistId, 'gist'],
      [STORAGE_KEYS.gistSyncEnabled, true],
    ]);
  });

  it.each(['validate', 'create'] as const)(
    'can %s with a supplied client without credential access',
    async (operation) => {
      const client = createGitHubClient('supplied');
      const acquire = vi.spyOn(auth, 'getAuthenticatedGitHubClient');
      const reads = vi.spyOn(storage, 'getItem');
      getGist.mockResolvedValue({ data: { files: { 'leetsrs-backup.json': {} } } });
      create.mockResolvedValue({ data: { id: 'created' } });
      exportData.mockResolvedValue('{"snapshot":true}');

      if (operation === 'validate') {
        expect(await validateGist(' gist ', client)).toEqual({ valid: true });
        expect(getGist).toHaveBeenCalledExactlyOnceWith({ gist_id: ' gist ' });
      } else {
        expect(await createGist(client)).toEqual({ gistId: 'created' });
        expect(create).toHaveBeenCalledExactlyOnceWith({
          description: expect.any(String),
          public: false,
          files: { 'leetsrs-backup.json': { content: '{"snapshot":true}' } },
        });
      }
      expect(acquire).not.toHaveBeenCalled();
      expect(getAuthenticated).not.toHaveBeenCalled();
      expect(reads.mock.calls.map(([key]) => key)).not.toContain(STORAGE_KEYS.githubPat);
    }
  );

  it.each(['', ' \t\n'])('rejects blank Gist ID %j without acquiring a client or requesting a Gist', async (gistId) => {
    const acquire = vi.spyOn(auth, 'getAuthenticatedGitHubClient');
    expect(await validateGistId(gistId, 'token')).toEqual({ valid: false, error: 'Gist ID is required' });
    expect(acquire).not.toHaveBeenCalled();
    expect(await validateGist(gistId, createGitHubClient('supplied'))).toEqual({
      valid: false,
      error: 'Gist ID is required',
    });
    expect(getGist).not.toHaveBeenCalled();
  });

  it('validates with the exact supplied PAT without reading or changing saved credentials', async () => {
    await storage.setItem(STORAGE_KEYS.githubPat, 'saved');
    const reads = vi.spyOn(storage, 'getItem');
    const writes = vi.spyOn(storage, 'setItem');
    const acquire = vi.spyOn(auth, 'getAuthenticatedGitHubClient');
    getGist.mockResolvedValue({ data: { files: { 'leetsrs-backup.json': {} } } });

    expect(await validateGistId(' gist ', ' token ')).toEqual({ valid: true });
    expect(acquire).toHaveBeenCalledExactlyOnceWith(' token ');
    expect(Octokit).toHaveBeenCalledExactlyOnceWith({ auth: ' token ' });
    expect(reads).not.toHaveBeenCalled();
    expect(writes).not.toHaveBeenCalled();
    expect(getAuthenticated).not.toHaveBeenCalled();
  });

  it.each([
    [new Error('404 Not Found'), 'Gist not found'],
    [new Error('Network error'), 'Network error'],
    ['failure', 'Unknown error validating Gist ID'],
  ])('preserves validation results when client acquisition fails: %j', async (failure, error) => {
    vi.spyOn(auth, 'getAuthenticatedGitHubClient').mockRejectedValue(failure);
    expect(await validateGistId('gist', 'token')).toEqual({ valid: false, error });
    expect(getGist).not.toHaveBeenCalled();
  });

  it('preserves configuration-read failures before creation acquires its client', async () => {
    await storage.setItem(STORAGE_KEYS.githubPat, 'saved');
    const read = storage.getItem.bind(storage);
    vi.spyOn(storage, 'getItem').mockImplementation((key, options) => {
      if (key === STORAGE_KEYS.gistId) return Promise.reject(new Error('read failed'));
      return read(key, options);
    });
    const acquire = vi.spyOn(auth, 'getAuthenticatedGitHubClient');

    await expect(createNewGist()).rejects.toThrow('read failed');
    expect(acquire).not.toHaveBeenCalled();
    expect(exportData).not.toHaveBeenCalled();
  });

  it.each(['export', 'request', 'destination'] as const)(
    'stops creation persistence after a failed %s',
    async (stage) => {
      const client = createGitHubClient('supplied');
      const failure = new Error('failed');
      exportData.mockResolvedValue('{}');
      create.mockResolvedValue({ data: { id: 'created' } });
      const writes = vi.spyOn(storage, 'setItem');
      if (stage === 'export') exportData.mockRejectedValue(failure);
      if (stage === 'request') create.mockRejectedValue(failure);
      if (stage === 'destination') writes.mockRejectedValue(failure);

      await expect(createGist(client)).rejects.toBe(failure);
      expect(writes.mock.calls).toEqual(stage === 'destination' ? [[STORAGE_KEYS.gistId, 'created']] : []);
      if (stage === 'export') expect(create).not.toHaveBeenCalled();
    }
  );
});
