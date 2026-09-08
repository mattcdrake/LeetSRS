import { Octokit } from 'octokit';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fakeBrowser } from 'wxt/testing/fake-browser';
import { storage } from 'wxt/utils/storage';
import { createGitHubClient } from '@/infrastructure/github/client';
import { STORAGE_KEYS } from '@/infrastructure/storage/storage-keys';
import {
  createGist,
  createNewGist,
  getGistDestinationConfig,
  getGistSyncConfig,
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

  it.each([
    { name: 'empty storage', saved: false, expected: { pat: '', gistId: null, enabled: false } },
    { name: 'saved configuration', saved: true, expected: { pat: 'token', gistId: 'gist', enabled: true } },
  ])('reads $name through destination and combined configuration', async ({ saved, expected }) => {
    if (saved) {
      await storage.setItem(STORAGE_KEYS.githubPat, expected.pat);
      await storage.setItem(STORAGE_KEYS.gistId, expected.gistId);
      await storage.setItem(STORAGE_KEYS.gistSyncEnabled, expected.enabled);
    }
    const reads = vi.spyOn(storage, 'getItem');
    expect(await getGistDestinationConfig()).toEqual({ gistId: expected.gistId, enabled: expected.enabled });
    expect(reads.mock.calls.map(([key]) => key)).not.toContain(STORAGE_KEYS.githubPat);
    expect(await getGistSyncConfig()).toEqual(expected);
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
    { stage: 'acquisition', failure: new Error('404 Not Found'), error: 'Gist not found' },
    { stage: 'acquisition', failure: new Error('Network error'), error: 'Network error' },
    { stage: 'acquisition', failure: 'failure', error: 'Unknown error validating Gist ID' },
    { stage: 'request', failure: new Error('404 Not Found'), error: 'Gist not found' },
    { stage: 'request', failure: new Error('Network error'), error: 'Network error' },
  ])('maps $stage failure to "$error"', async ({ stage, failure, error }) => {
    if (stage === 'acquisition') vi.spyOn(auth, 'getAuthenticatedGitHubClient').mockRejectedValue(failure);
    else getGist.mockRejectedValue(failure);

    expect(await validateGistId('gist', 'token')).toEqual({ valid: false, error });
    expect(getGist).toHaveBeenCalledTimes(stage === 'acquisition' ? 0 : 1);
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
  it.each([{ pat: 'replacement' }, { gistId: 'replacement-gist' }, { gistId: null }, { enabled: true }])(
    'applies partial update %j while preserving other fields',
    async (update) => {
      const original = { pat: 'original', gistId: 'original-gist', enabled: false };
      await storage.setItem(STORAGE_KEYS.githubPat, original.pat);
      await storage.setItem(STORAGE_KEYS.gistId, original.gistId);
      await storage.setItem(STORAGE_KEYS.gistSyncEnabled, original.enabled);

      await setGistSyncConfig(update);

      expect(await getGistSyncConfig()).toEqual({ ...original, ...update });
      if (update.gistId === null) expect(await storage.getItem(STORAGE_KEYS.gistId)).toBeNull();
    }
  );

  describe('validateGistId', () => {
    it('should return error when gist exists but missing backup file', async () => {
      getGist.mockResolvedValue({
        data: {
          files: {
            'other-file.txt': { content: 'hello' },
          },
        },
      });

      const result = await validateGistId('abc123', 'ghp_test');

      expect(result).toEqual({
        valid: false,
        error: 'Gist does not contain leetsrs-backup.json',
      });
    });
  });

  describe('createNewGist', () => {
    it('should throw error when PAT not configured', async () => {
      await expect(createNewGist()).rejects.toThrow('PAT is required to create a gist');
    });

    it('should throw when gist creation fails with no ID', async () => {
      await storage.setItem(STORAGE_KEYS.githubPat, 'ghp_test');
      exportData.mockResolvedValue('{}');
      create.mockResolvedValue({ data: {} });

      await expect(createNewGist()).rejects.toThrow('Failed to create gist: no ID returned');
    });
  });

  describe('creation and configuration persistence', () => {
    const now = '2024-02-01T12:00:00.000Z';
    const later = '2024-02-01T12:00:01.000Z';

    beforeEach(async () => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date(now));
      await storage.setItem(STORAGE_KEYS.githubPat, 'ghp_test');
      await storage.setItem(STORAGE_KEYS.gistId, 'gist123');
    });

    afterEach(() => vi.useRealTimers());

    it.each([STORAGE_KEYS.lastSyncTime, STORAGE_KEYS.lastSyncDirection])(
      'retains the created destination when writing %s fails',
      async (failedKey) => {
        exportData.mockResolvedValue('{}');
        create.mockResolvedValue({ data: { id: 'created' } });
        const write = storage.setItem.bind(storage);
        const writes = vi.spyOn(storage, 'setItem').mockImplementation((key, value) => {
          if (key === failedKey) return Promise.reject(new Error('status failed'));
          return write(key, value);
        });

        await expect(createNewGist()).rejects.toThrow('status failed');

        expect(create).toHaveBeenCalledOnce();
        expect(await storage.getItem(STORAGE_KEYS.gistId)).toBe('created');
        expect(await storage.getItem(STORAGE_KEYS.lastSyncTime)).toBe(
          failedKey === STORAGE_KEYS.lastSyncTime ? null : now
        );
        expect(await storage.getItem(STORAGE_KEYS.lastSyncDirection)).toBeNull();
        const expectedWrites: unknown[][] = [
          [STORAGE_KEYS.gistId, 'created'],
          [STORAGE_KEYS.lastSyncTime, now],
        ];
        if (failedKey === STORAGE_KEYS.lastSyncDirection) expectedWrites.push([STORAGE_KEYS.lastSyncDirection, 'push']);
        expect(writes.mock.calls).toEqual(expectedWrites);
      }
    );

    it('creates the client before export, resolves localization afterward, then saves ID before status', async () => {
      await storage.setItem(STORAGE_KEYS.language, 'en');
      exportData.mockImplementation(async () => {
        expect(Octokit).toHaveBeenCalledExactlyOnceWith({ auth: 'ghp_test' });
        await storage.setItem(STORAGE_KEYS.language, 'zh-CN');
        await storage.setItem(STORAGE_KEYS.githubPat, 'replacement');
        return '{"local":"snapshot"}';
      });
      create.mockImplementation(async () => {
        expect(await storage.getItem(STORAGE_KEYS.gistId)).toBe('gist123');
        vi.setSystemTime(new Date(later));
        return { data: { id: 'created' } };
      });
      const writes = vi.spyOn(storage, 'setItem');

      await expect(createNewGist()).resolves.toEqual({ gistId: 'created' });

      expect(Octokit).toHaveBeenCalledExactlyOnceWith({ auth: 'ghp_test' });
      expect(getAuthenticated).not.toHaveBeenCalled();
      expect(create).toHaveBeenCalledExactlyOnceWith({
        description: 'LeetSRS 备份 - 间隔重复数据',
        public: false,
        files: { 'leetsrs-backup.json': { content: '{"local":"snapshot"}' } },
      });
      expect(writes.mock.calls).toEqual([
        [STORAGE_KEYS.language, 'zh-CN'],
        [STORAGE_KEYS.githubPat, 'replacement'],
        [STORAGE_KEYS.gistId, 'created'],
        [STORAGE_KEYS.lastSyncTime, later],
        [STORAGE_KEYS.lastSyncDirection, 'push'],
      ]);
      expect(await storage.getItem(STORAGE_KEYS.gistId)).toBe('created');
      expect(await storage.getItem(STORAGE_KEYS.lastSyncTime)).toBe(later);
      expect(await storage.getItem(STORAGE_KEYS.lastSyncDirection)).toBe('push');
    });

    it('keeps an earlier config write when a later update fails, skipping remaining fields', async () => {
      const remove = vi.spyOn(storage, 'removeItem').mockRejectedValue(new Error('remove failed'));
      const writes = vi.spyOn(storage, 'setItem');

      await expect(setGistSyncConfig({ pat: 'new-pat', gistId: null, enabled: true })).rejects.toThrow('remove failed');

      expect(writes.mock.calls).toEqual([[STORAGE_KEYS.githubPat, 'new-pat']]);
      expect(remove).toHaveBeenCalledExactlyOnceWith(STORAGE_KEYS.gistId);
      expect(await storage.getItem(STORAGE_KEYS.githubPat)).toBe('new-pat');
      expect(await storage.getItem(STORAGE_KEYS.gistSyncEnabled)).toBeNull();
    });
  });
});
