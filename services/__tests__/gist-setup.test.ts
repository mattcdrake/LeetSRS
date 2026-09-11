import { Octokit } from 'octokit';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fakeBrowser } from 'wxt/testing/fake-browser';
import { storage } from 'wxt/utils/storage';
import type { GistSyncConfigUpdate } from '@/domain/gist-sync';
import { STORAGE_KEYS } from '@/infrastructure/storage/storage-keys';
import { createNewGist, getGistSyncConfig, setGistSyncConfig, validateGistId } from '../gist-setup';
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
  ])('reads $name', async ({ saved, expected }) => {
    if (saved) {
      await storage.setItem(STORAGE_KEYS.gistConnection, expected);
    }
    expect(await getGistSyncConfig()).toEqual(expected);
  });

  it('persists the complete configuration without marking learning data edited', async () => {
    const config = { pat: ' token ', gistId: 'gist', enabled: true };
    const writes = vi.spyOn(fakeBrowser.storage.local, 'set');
    await setGistSyncConfig(config);
    expect(writes).toHaveBeenCalledExactlyOnceWith({ 'leetsrs:gistConnection': config });
    expect(await fakeBrowser.storage.sync.get(null)).toEqual({});
    expect(await getGistSyncConfig()).toEqual(config);
    expect(await storage.getItem(STORAGE_KEYS.dataUpdatedAt)).toBeNull();
  });

  it.each([
    { pat: 'replacement', gistId: 42 },
    { pat: 'replacement', enabled: 'yes' },
  ])('rejects malformed configuration before any writes: %j', async (config) => {
    const writes = vi.spyOn(storage, 'setItem');
    await expect(setGistSyncConfig(config as unknown as GistSyncConfigUpdate)).rejects.toThrow();
    expect(writes).not.toHaveBeenCalled();
    expect(await getGistSyncConfig()).toEqual({ pat: '', gistId: null, enabled: false });
  });

  it('ignores undefined configuration fields', async () => {
    await setGistSyncConfig({ pat: 'token', gistId: 'gist', enabled: true });
    const writes = vi.spyOn(storage, 'setItem');
    await setGistSyncConfig({ pat: undefined, gistId: undefined, enabled: undefined });
    expect(writes).not.toHaveBeenCalled();
    expect(await getGistSyncConfig()).toEqual({ pat: 'token', gistId: 'gist', enabled: true });
  });

  it.each(['', ' \t\n'])('rejects blank Gist ID %j without acquiring a client or requesting a Gist', async (gistId) => {
    const acquire = vi.spyOn(auth, 'getAuthenticatedGitHubClient');
    expect(await validateGistId(gistId, 'token')).toEqual({ valid: false, error: 'Gist ID is required' });
    expect(acquire).not.toHaveBeenCalled();
    expect(getGist).not.toHaveBeenCalled();
  });

  it('validates with the exact supplied PAT without reading or changing saved credentials', async () => {
    await storage.setItem(STORAGE_KEYS.gistConnection, { pat: 'saved', gistId: null, enabled: false });
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

  it('propagates configuration-read failures during creation', async () => {
    await storage.setItem(STORAGE_KEYS.gistConnection, { pat: 'saved', gistId: null, enabled: false });
    const read = storage.getItem.bind(storage);
    vi.spyOn(storage, 'getItem').mockImplementation((key, options) => {
      if (key === STORAGE_KEYS.gistConnection) return Promise.reject(new Error('read failed'));
      return read(key, options);
    });
    await expect(createNewGist()).rejects.toThrow('read failed');
    expect(create).not.toHaveBeenCalled();
  });

  it.each(['export', 'request', 'destination'] as const)(
    'stops creation persistence after a failed %s',
    async (stage) => {
      await storage.setItem(STORAGE_KEYS.gistConnection, { pat: 'saved', gistId: null, enabled: false });
      const failure = new Error('failed');
      exportData.mockResolvedValue('{}');
      create.mockResolvedValue({ data: { id: 'created' } });
      const writes = vi.spyOn(storage, 'setItem');
      if (stage === 'export') exportData.mockRejectedValue(failure);
      if (stage === 'request') create.mockRejectedValue(failure);
      if (stage === 'destination') writes.mockRejectedValue(failure);

      await expect(createNewGist()).rejects.toBe(failure);
      expect(writes.mock.calls).toEqual(
        stage === 'destination'
          ? [[STORAGE_KEYS.gistConnection, { pat: 'saved', gistId: 'created', enabled: false }]]
          : []
      );
      if (stage === 'export') expect(create).not.toHaveBeenCalled();
    }
  );
  it.each([{ pat: 'replacement' }, { gistId: 'replacement-gist' }, { gistId: null }, { enabled: true }])(
    'applies partial update %j while preserving other fields',
    async (update) => {
      const original = { pat: 'original', gistId: 'original-gist', enabled: false };
      await storage.setItem(STORAGE_KEYS.gistConnection, original);

      await setGistSyncConfig(update);

      expect(await getGistSyncConfig()).toEqual({ ...original, ...update });
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
      await storage.setItem(STORAGE_KEYS.gistConnection, { pat: 'ghp_test', gistId: null, enabled: false });
      exportData.mockResolvedValue('{}');
      create.mockResolvedValue({ data: {} });

      await expect(createNewGist()).rejects.toThrow('Failed to create gist: no ID returned');
    });
  });

  describe('creation and configuration persistence', () => {
    const now = '2024-02-01T12:00:00.000Z';

    beforeEach(async () => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date(now));
      await storage.setItem(STORAGE_KEYS.gistConnection, { pat: 'ghp_test', gistId: 'gist123', enabled: false });
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
        expect((await getGistSyncConfig()).gistId).toBe('created');
        expect(await storage.getItem(STORAGE_KEYS.lastSyncTime)).toBe(
          failedKey === STORAGE_KEYS.lastSyncTime ? null : now
        );
        expect(await storage.getItem(STORAGE_KEYS.lastSyncDirection)).toBeNull();
        const expectedWrites: unknown[][] = [
          [STORAGE_KEYS.gistConnection, { pat: 'ghp_test', gistId: 'created', enabled: false }],
          [STORAGE_KEYS.lastSyncTime, now],
        ];
        if (failedKey === STORAGE_KEYS.lastSyncDirection) expectedWrites.push([STORAGE_KEYS.lastSyncDirection, 'push']);
        expect(writes.mock.calls).toEqual(expectedWrites);
      }
    );

    it('creates a secret localized backup and saves the destination and sync status', async () => {
      await storage.setItem(STORAGE_KEYS.language, 'zh-CN');
      exportData.mockResolvedValue('{"local":"snapshot"}');
      create.mockResolvedValue({ data: { id: 'created' } });

      await expect(createNewGist()).resolves.toEqual({ gistId: 'created' });

      expect(Octokit).toHaveBeenCalledWith({ auth: 'ghp_test' });
      expect(create).toHaveBeenCalledExactlyOnceWith({
        description: 'LeetSRS 备份 - 间隔重复数据',
        public: false,
        files: { 'leetsrs-backup.json': { content: '{"local":"snapshot"}' } },
      });
      expect((await getGistSyncConfig()).gistId).toBe('created');
      expect(await storage.getItem(STORAGE_KEYS.lastSyncTime)).toBe(now);
      expect(await storage.getItem(STORAGE_KEYS.lastSyncDirection)).toBe('push');
    });

    it('preserves the whole connection when its replacement fails', async () => {
      const before = await getGistSyncConfig();
      const writes = vi.spyOn(storage, 'setItem').mockRejectedValueOnce(new Error('write failed'));

      await expect(setGistSyncConfig({ pat: 'new-pat', gistId: null, enabled: true })).rejects.toThrow('write failed');

      expect(writes).toHaveBeenCalledExactlyOnceWith(STORAGE_KEYS.gistConnection, {
        pat: 'new-pat',
        gistId: null,
        enabled: true,
      });
      expect(await getGistSyncConfig()).toEqual(before);
    });
  });
});
