import { Octokit } from 'octokit';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fakeBrowser } from 'wxt/testing/fake-browser';
import { storage } from 'wxt/utils/storage';
import { STORAGE_KEYS } from '@/infrastructure/storage/storage-keys';
import { createDeferred } from '@/test/utils/deferred';

// Mock Octokit
const mockGetAuthenticated = vi.fn();
const mockGistsGet = vi.fn();
const mockGistsCreate = vi.fn();
const mockGistsUpdate = vi.fn();

vi.mock('octokit', () => ({
  Octokit: vi.fn(function MockOctokit() {
    return {
      rest: {
        users: { getAuthenticated: mockGetAuthenticated },
        gists: {
          get: mockGistsGet,
          create: mockGistsCreate,
          update: mockGistsUpdate,
        },
      },
    };
  }),
}));

// Mock import-export
const mockExportData = vi.fn();
const mockImportData = vi.fn();

vi.mock('../import-export', () => ({
  exportData: (...args: unknown[]) => mockExportData(...args),
  importData: (...args: unknown[]) => mockImportData(...args),
}));

// Import after mocks are set up
import {
  createNewGist,
  getGistSyncConfig,
  getGistSyncStatus,
  setGistSyncConfig,
  triggerGistSync,
  validateGistId,
  validatePat,
} from '../github-sync';

describe('github-sync', () => {
  beforeEach(() => {
    fakeBrowser.reset();
    fakeBrowser.runtime.id = 'test';
    vi.resetAllMocks();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('getGistSyncConfig', () => {
    it('should return default values when storage is empty', async () => {
      const config = await getGistSyncConfig();

      expect(config).toEqual({
        pat: '',
        gistId: null,
        enabled: false,
      });
    });

    it('should return stored values when set', async () => {
      await storage.setItem(STORAGE_KEYS.githubPat, 'ghp_test123');
      await storage.setItem(STORAGE_KEYS.gistId, 'abc123');
      await storage.setItem(STORAGE_KEYS.gistSyncEnabled, true);

      const config = await getGistSyncConfig();

      expect(config).toEqual({
        pat: 'ghp_test123',
        gistId: 'abc123',
        enabled: true,
      });
    });
  });

  describe('setGistSyncConfig', () => {
    it('should save PAT to storage', async () => {
      await setGistSyncConfig({ pat: 'ghp_newtoken' });

      expect(await storage.getItem(STORAGE_KEYS.githubPat)).toBe('ghp_newtoken');
    });

    it('should save gistId to storage', async () => {
      await setGistSyncConfig({ gistId: 'gist123' });

      expect(await storage.getItem(STORAGE_KEYS.gistId)).toBe('gist123');
    });

    it('should remove gistId when set to null', async () => {
      await storage.setItem(STORAGE_KEYS.gistId, 'existing-gist');

      await setGistSyncConfig({ gistId: null });

      expect(await storage.getItem(STORAGE_KEYS.gistId)).toBeNull();
    });

    it('should save enabled flag', async () => {
      await setGistSyncConfig({ enabled: true });

      expect(await storage.getItem(STORAGE_KEYS.gistSyncEnabled)).toBe(true);
    });

    it('should handle partial updates', async () => {
      await storage.setItem(STORAGE_KEYS.githubPat, 'original-pat');
      await storage.setItem(STORAGE_KEYS.gistId, 'original-gist');
      await storage.setItem(STORAGE_KEYS.gistSyncEnabled, false);

      await setGistSyncConfig({ enabled: true });

      expect(await storage.getItem(STORAGE_KEYS.githubPat)).toBe('original-pat');
      expect(await storage.getItem(STORAGE_KEYS.gistId)).toBe('original-gist');
      expect(await storage.getItem(STORAGE_KEYS.gistSyncEnabled)).toBe(true);
    });
  });

  describe('getGistSyncStatus', () => {
    it('should return null timestamps when never synced', async () => {
      const status = await getGistSyncStatus();

      expect(status.lastSyncTime).toBeNull();
      expect(status.lastSyncDirection).toBeNull();
    });

    it('should return stored sync time and direction', async () => {
      await storage.setItem(STORAGE_KEYS.lastSyncTime, '2024-01-15T10:00:00Z');
      await storage.setItem(STORAGE_KEYS.lastSyncDirection, 'push');

      const status = await getGistSyncStatus();

      expect(status.lastSyncTime).toBe('2024-01-15T10:00:00Z');
      expect(status.lastSyncDirection).toBe('push');
    });
  });

  describe('validatePat', () => {
    it.each(['', '   '])('should return an error for missing PAT input %#', async (pat) => {
      const result = await validatePat(pat);
      expect(result).toEqual({ valid: false, error: 'PAT is required' });
    });

    it('should return valid with username on successful auth', async () => {
      mockGetAuthenticated.mockResolvedValue({ data: { login: 'testuser' } });

      const result = await validatePat('ghp_valid_token');

      expect(result).toEqual({ valid: true, username: 'testuser' });
    });

    it('should return error on 401', async () => {
      mockGetAuthenticated.mockRejectedValue(new Error('401 Unauthorized'));

      const result = await validatePat('ghp_invalid_token');

      expect(result).toEqual({ valid: false, error: 'Invalid token' });
    });

    it('should return error about gist scope on 403', async () => {
      mockGetAuthenticated.mockRejectedValue(new Error('403 Forbidden'));

      const result = await validatePat('ghp_no_gist_scope');

      expect(result).toEqual({
        valid: false,
        error: 'Token lacks required permissions (needs gist scope)',
      });
    });

    it('should return error message for other errors', async () => {
      mockGetAuthenticated.mockRejectedValue(new Error('Network error'));

      const result = await validatePat('ghp_test');

      expect(result).toEqual({ valid: false, error: 'Network error' });
    });

    it('should return unknown error for non-Error exceptions', async () => {
      mockGetAuthenticated.mockRejectedValue('string error');

      const result = await validatePat('ghp_test');

      expect(result).toEqual({ valid: false, error: 'Unknown error validating token' });
    });
  });

  describe('validateGistId', () => {
    it.each(['', '   '])('should return an error for missing gist ID input %#', async (gistId) => {
      const result = await validateGistId(gistId, 'ghp_test');
      expect(result).toEqual({ valid: false, error: 'Gist ID is required' });
    });

    it('should return valid when gist exists and contains the backup file', async () => {
      mockGistsGet.mockResolvedValue({
        data: {
          files: {
            'leetsrs-backup.json': { content: '{}' },
          },
        },
      });

      const result = await validateGistId('abc123', 'ghp_test');

      expect(result).toEqual({ valid: true });
    });

    it('should return error when gist exists but missing backup file', async () => {
      mockGistsGet.mockResolvedValue({
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

    it('should return "Gist not found" on 404', async () => {
      mockGistsGet.mockRejectedValue(new Error('404 Not Found'));

      const result = await validateGistId('nonexistent', 'ghp_test');

      expect(result).toEqual({ valid: false, error: 'Gist not found' });
    });

    it('should return error message for other errors', async () => {
      mockGistsGet.mockRejectedValue(new Error('Network error'));

      const result = await validateGistId('abc123', 'ghp_test');

      expect(result).toEqual({ valid: false, error: 'Network error' });
    });
  });

  describe('createNewGist', () => {
    it('should throw error when PAT not configured', async () => {
      await expect(createNewGist()).rejects.toThrow('PAT is required to create a gist');
    });

    it('should create private gist and return gist ID', async () => {
      await storage.setItem(STORAGE_KEYS.githubPat, 'ghp_test');
      mockExportData.mockResolvedValue('{"data": "test"}');
      mockGistsCreate.mockResolvedValue({ data: { id: 'new-gist-123' } });

      const result = await createNewGist();

      expect(result).toEqual({ gistId: 'new-gist-123' });
      expect(mockGistsCreate).toHaveBeenCalledWith({
        description: expect.any(String),
        public: false,
        files: {
          'leetsrs-backup.json': {
            content: '{"data": "test"}',
          },
        },
      });
    });

    it('should save new gist ID to storage', async () => {
      await storage.setItem(STORAGE_KEYS.githubPat, 'ghp_test');
      mockExportData.mockResolvedValue('{}');
      mockGistsCreate.mockResolvedValue({ data: { id: 'saved-gist' } });

      await createNewGist();

      expect(await storage.getItem(STORAGE_KEYS.gistId)).toBe('saved-gist');
    });

    it('should update lastSyncTime and lastSyncDirection', async () => {
      await storage.setItem(STORAGE_KEYS.githubPat, 'ghp_test');
      mockExportData.mockResolvedValue('{}');
      mockGistsCreate.mockResolvedValue({ data: { id: 'gist123' } });

      await createNewGist();

      expect(await storage.getItem(STORAGE_KEYS.lastSyncTime)).toMatch(/^\d{4}-\d{2}-\d{2}T/);
      expect(await storage.getItem(STORAGE_KEYS.lastSyncDirection)).toBe('push');
    });

    it('should throw when gist creation fails with no ID', async () => {
      await storage.setItem(STORAGE_KEYS.githubPat, 'ghp_test');
      mockExportData.mockResolvedValue('{}');
      mockGistsCreate.mockResolvedValue({ data: {} });

      await expect(createNewGist()).rejects.toThrow('Failed to create gist: no ID returned');
    });
  });

  describe('triggerGistSync', () => {
    beforeEach(async () => {
      await storage.setItem(STORAGE_KEYS.githubPat, 'ghp_test');
      await storage.setItem(STORAGE_KEYS.gistId, 'gist123');
    });

    describe('precondition checks', () => {
      it('should return error if PAT not configured', async () => {
        await storage.removeItem(STORAGE_KEYS.githubPat);

        const result = await triggerGistSync();

        expect(result).toEqual({ success: false, error: 'PAT is not configured' });
      });

      it('should return error if gist ID not configured', async () => {
        await storage.removeItem(STORAGE_KEYS.gistId);

        const result = await triggerGistSync();

        expect(result).toEqual({ success: false, error: 'Gist ID is not configured' });
      });

      it('should return "Gist not found" on 404', async () => {
        mockGistsGet.mockRejectedValue(new Error('404 Not Found'));

        const result = await triggerGistSync();

        expect(result).toEqual({ success: false, error: 'Gist not found' });
      });
    });

    describe('push scenarios', () => {
      it('should push when remote file is missing', async () => {
        mockGistsGet.mockResolvedValue({
          data: { files: {} },
        });
        mockExportData.mockResolvedValue('{"local": "data"}');
        mockGistsUpdate.mockResolvedValue({});

        const result = await triggerGistSync();

        expect(result).toMatchObject({ success: true, action: 'pushed' });
        expect(mockGistsUpdate).toHaveBeenCalled();
      });

      it('should push when remote file has invalid JSON', async () => {
        mockGistsGet.mockResolvedValue({
          data: {
            files: {
              'leetsrs-backup.json': { content: 'not valid json' },
            },
          },
        });
        mockExportData.mockResolvedValue('{"local": "data"}');
        mockGistsUpdate.mockResolvedValue({});

        const result = await triggerGistSync();

        expect(result).toMatchObject({ success: true, action: 'pushed' });
      });

      it('should push when remote has no dataUpdatedAt', async () => {
        await storage.setItem(STORAGE_KEYS.dataUpdatedAt, '2024-01-15T10:00:00Z');
        mockGistsGet.mockResolvedValue({
          data: {
            files: {
              'leetsrs-backup.json': { content: '{"data": {}}' },
            },
          },
        });
        mockExportData.mockResolvedValue('{"local": "data"}');
        mockGistsUpdate.mockResolvedValue({});

        const result = await triggerGistSync();

        expect(result).toMatchObject({ success: true, action: 'pushed' });
      });

      it('should push when local is newer than remote', async () => {
        await storage.setItem(STORAGE_KEYS.dataUpdatedAt, '2024-01-15T12:00:00Z');
        mockGistsGet.mockResolvedValue({
          data: {
            files: {
              'leetsrs-backup.json': {
                content: JSON.stringify({ dataUpdatedAt: '2024-01-15T10:00:00Z' }),
              },
            },
          },
        });
        mockExportData.mockResolvedValue('{"local": "data"}');
        mockGistsUpdate.mockResolvedValue({});

        const result = await triggerGistSync();

        expect(result).toMatchObject({ success: true, action: 'pushed' });
        expect(await storage.getItem(STORAGE_KEYS.lastSyncDirection)).toBe('push');
      });
    });

    describe('pull scenarios', () => {
      it('should pull when local has no dataUpdatedAt but remote does', async () => {
        mockGistsGet.mockResolvedValue({
          data: {
            files: {
              'leetsrs-backup.json': {
                content: JSON.stringify({ dataUpdatedAt: '2024-01-15T10:00:00Z' }),
              },
            },
          },
        });
        mockImportData.mockResolvedValue(undefined);

        const result = await triggerGistSync();

        expect(result).toMatchObject({ success: true, action: 'pulled' });
        expect(mockImportData).toHaveBeenCalled();
      });

      it('should pull when remote is newer than local', async () => {
        await storage.setItem(STORAGE_KEYS.dataUpdatedAt, '2024-01-15T08:00:00Z');
        mockGistsGet.mockResolvedValue({
          data: {
            files: {
              'leetsrs-backup.json': {
                content: JSON.stringify({ dataUpdatedAt: '2024-01-15T12:00:00Z' }),
              },
            },
          },
        });
        mockImportData.mockResolvedValue(undefined);

        const result = await triggerGistSync();

        expect(result).toMatchObject({ success: true, action: 'pulled' });
        expect(await storage.getItem(STORAGE_KEYS.lastSyncDirection)).toBe('pull');
      });
    });

    describe('no-change scenario', () => {
      it('should return no-change when timestamps are equal', async () => {
        const timestamp = '2024-01-15T10:00:00Z';
        await storage.setItem(STORAGE_KEYS.dataUpdatedAt, timestamp);
        mockGistsGet.mockResolvedValue({
          data: {
            files: {
              'leetsrs-backup.json': {
                content: JSON.stringify({ dataUpdatedAt: timestamp }),
              },
            },
          },
        });

        const result = await triggerGistSync();

        expect(result).toMatchObject({ success: true, action: 'no-change' });
      });
    });

    describe('error handling', () => {
      it('should return rate limit error on 403', async () => {
        mockGistsGet.mockRejectedValue(new Error('403 rate limit exceeded'));

        const result = await triggerGistSync();

        expect(result).toEqual({
          success: false,
          error: 'GitHub API rate limit exceeded. Please try again later.',
        });
      });

      it('should return error message for unknown errors', async () => {
        mockGistsGet.mockRejectedValue(new Error('Unexpected server error'));

        const result = await triggerGistSync();

        expect(result).toEqual({ success: false, error: 'Unexpected server error' });
      });
    });

    describe('concurrent sync prevention', () => {
      it('should prevent concurrent syncs', async () => {
        // Set up a slow operation
        mockGistsGet.mockImplementation(
          () => new Promise((resolve) => setTimeout(() => resolve({ data: { files: {} } }), 100))
        );
        mockExportData.mockResolvedValue('{}');
        mockGistsUpdate.mockResolvedValue({});

        // Start first sync
        const firstSync = triggerGistSync();

        // Immediately try second sync
        const secondSync = await triggerGistSync();

        expect(secondSync).toEqual({ success: false, error: 'Sync already in progress' });

        // Wait for first sync to complete
        await firstSync;
      });

      it('should allow new sync after previous completes', async () => {
        mockGistsGet.mockResolvedValue({ data: { files: {} } });
        mockExportData.mockResolvedValue('{}');
        mockGistsUpdate.mockResolvedValue({});

        // Complete first sync
        await triggerGistSync();

        // Second sync should work
        const result = await triggerGistSync();

        expect(result.success).toBe(true);
      });

      it('should reset syncInProgress on error', async () => {
        mockGistsGet.mockRejectedValueOnce(new Error('Network error'));

        // First sync fails
        await triggerGistSync();

        // Reset mock for success
        mockGistsGet.mockResolvedValue({ data: { files: {} } });
        mockExportData.mockResolvedValue('{}');
        mockGistsUpdate.mockResolvedValue({});

        // Second sync should work
        const result = await triggerGistSync();

        expect(result.success).toBe(true);
      });
    });
  });

  describe('extraction characterization', () => {
    const now = '2024-02-01T12:00:00.000Z';
    const later = '2024-02-01T12:00:01.000Z';

    beforeEach(async () => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date(now));
      await storage.setItem(STORAGE_KEYS.githubPat, 'ghp_test');
      await storage.setItem(STORAGE_KEYS.gistId, 'gist123');
    });

    it('passes untrimmed credentials and IDs to validation requests', async () => {
      mockGetAuthenticated.mockResolvedValue({ data: { login: 'testuser' } });
      mockGistsGet.mockResolvedValue({ data: { files: { 'leetsrs-backup.json': {} } } });

      expect(await validatePat(' token ')).toEqual({ valid: true, username: 'testuser' });
      expect(await validateGistId(' gist ', ' token ')).toEqual({ valid: true });

      expect(vi.mocked(Octokit).mock.calls).toEqual([[{ auth: ' token ' }], [{ auth: ' token ' }]]);
      expect(mockGetAuthenticated).toHaveBeenCalledExactlyOnceWith();
      expect(mockGistsGet).toHaveBeenCalledExactlyOnceWith({ gist_id: ' gist ' });
    });

    it('creates the client before export, resolves localization afterward, then saves ID before status', async () => {
      await storage.setItem(STORAGE_KEYS.language, 'en');
      mockExportData.mockImplementation(async () => {
        expect(Octokit).toHaveBeenCalledExactlyOnceWith({ auth: 'ghp_test' });
        await storage.setItem(STORAGE_KEYS.language, 'zh-CN');
        return '{"local":"snapshot"}';
      });
      mockGistsCreate.mockImplementation(async () => {
        expect(await storage.getItem(STORAGE_KEYS.gistId)).toBe('gist123');
        vi.setSystemTime(new Date(later));
        return { data: { id: 'created' } };
      });
      const writes = vi.spyOn(storage, 'setItem');

      await expect(createNewGist()).resolves.toEqual({ gistId: 'created' });

      expect(mockGistsCreate).toHaveBeenCalledExactlyOnceWith({
        description: 'LeetSRS 备份 - 间隔重复数据',
        public: false,
        files: { 'leetsrs-backup.json': { content: '{"local":"snapshot"}' } },
      });
      expect(writes.mock.calls).toEqual([
        [STORAGE_KEYS.language, 'zh-CN'],
        [STORAGE_KEYS.gistId, 'created'],
        [STORAGE_KEYS.lastSyncTime, later],
        [STORAGE_KEYS.lastSyncDirection, 'push'],
      ]);
    });

    it('initializes a missing legacy timestamp before export and samples status after the push', async () => {
      mockGistsGet.mockResolvedValue({ data: { files: { 'leetsrs-backup.json': { content: '{}' } } } });
      mockExportData.mockImplementation(async () => {
        expect(await storage.getItem(STORAGE_KEYS.dataUpdatedAt)).toBe(now);
        return '{"export":"unchanged"}';
      });
      mockGistsUpdate.mockImplementation(async () => {
        expect(await storage.getItem(STORAGE_KEYS.lastSyncTime)).toBeNull();
        vi.setSystemTime(new Date(later));
      });
      const writes = vi.spyOn(storage, 'setItem');

      expect(await triggerGistSync()).toEqual({ success: true, action: 'pushed', timestamp: later });

      expect(Octokit).toHaveBeenCalledExactlyOnceWith({ auth: 'ghp_test' });
      expect(mockGistsGet).toHaveBeenCalledExactlyOnceWith({ gist_id: 'gist123' });
      expect(mockGistsUpdate).toHaveBeenCalledExactlyOnceWith({
        gist_id: 'gist123',
        files: { 'leetsrs-backup.json': { content: '{"export":"unchanged"}' } },
      });
      expect(writes.mock.calls).toEqual([
        [STORAGE_KEYS.dataUpdatedAt, now],
        [STORAGE_KEYS.lastSyncTime, later],
        [STORAGE_KEYS.lastSyncDirection, 'push'],
      ]);
    });

    it('imports the exact remote content before sampling and writing pull status', async () => {
      const content = '{ "dataUpdatedAt": "2024-01-01T00:00:00Z", "data": {} }';
      mockGistsGet.mockResolvedValue({ data: { files: { 'leetsrs-backup.json': { content } } } });
      mockImportData.mockImplementation(async () => {
        expect(await storage.getItem(STORAGE_KEYS.lastSyncTime)).toBeNull();
        vi.setSystemTime(new Date(later));
      });
      const writes = vi.spyOn(storage, 'setItem');

      expect(await triggerGistSync()).toEqual({ success: true, action: 'pulled', timestamp: later });

      expect(mockImportData).toHaveBeenCalledExactlyOnceWith(content);
      expect(mockExportData).not.toHaveBeenCalled();
      expect(mockGistsUpdate).not.toHaveBeenCalled();
      expect(writes.mock.calls).toEqual([
        [STORAGE_KEYS.lastSyncTime, later],
        [STORAGE_KEYS.lastSyncDirection, 'pull'],
      ]);
    });

    it('writes only sync time when timestamps match, preserving the previous direction', async () => {
      await storage.setItem(STORAGE_KEYS.dataUpdatedAt, now);
      await storage.setItem(STORAGE_KEYS.lastSyncDirection, 'pull');
      mockGistsGet.mockResolvedValue({
        data: { files: { 'leetsrs-backup.json': { content: JSON.stringify({ dataUpdatedAt: now }) } } },
      });
      const writes = vi.spyOn(storage, 'setItem');

      expect(await triggerGistSync()).toEqual({ success: true, action: 'no-change', timestamp: now });

      expect(writes.mock.calls).toEqual([[STORAGE_KEYS.lastSyncTime, now]]);
      expect(await getGistSyncStatus()).toEqual({
        lastSyncTime: now,
        lastSyncDirection: 'pull',
        syncInProgress: false,
        lastError: null,
      });
      expect(mockImportData).not.toHaveBeenCalled();
      expect(mockExportData).not.toHaveBeenCalled();
      expect(mockGistsUpdate).not.toHaveBeenCalled();
    });

    it.each(['push', 'pull'] as const)('does not write status when %s fails', async (direction) => {
      const failure = new Error('403 Forbidden');
      const content = JSON.stringify({ dataUpdatedAt: now });
      mockGistsGet.mockResolvedValue({
        data: { files: direction === 'pull' ? { 'leetsrs-backup.json': { content } } : {} },
      });
      mockExportData.mockResolvedValue('{}');
      mockGistsUpdate.mockRejectedValue(failure);
      mockImportData.mockRejectedValue(failure);
      const writes = vi.spyOn(storage, 'setItem');

      expect(await triggerGistSync()).toEqual({
        success: false,
        error: 'GitHub API rate limit exceeded. Please try again later.',
      });

      expect(writes).not.toHaveBeenCalled();
      expect(await getGistSyncStatus()).toEqual({
        lastSyncTime: null,
        lastSyncDirection: null,
        syncInProgress: false,
        lastError: '403 Forbidden',
      });
    });

    it('retains the successful remote write and sync time if the direction write fails', async () => {
      mockGistsGet.mockResolvedValue({ data: { files: {} } });
      mockExportData.mockResolvedValue('{}');
      mockGistsUpdate.mockResolvedValue({});
      const write = storage.setItem.bind(storage);
      const writes = vi.spyOn(storage, 'setItem').mockImplementation(async (key, value) => {
        if (key === STORAGE_KEYS.lastSyncDirection) throw new Error('direction write failed');
        return write(key, value);
      });

      expect(await triggerGistSync()).toEqual({ success: false, error: 'direction write failed' });

      expect(mockGistsUpdate).toHaveBeenCalledTimes(1);
      expect(writes.mock.calls).toEqual([
        [STORAGE_KEYS.lastSyncTime, now],
        [STORAGE_KEYS.lastSyncDirection, 'push'],
      ]);
      expect(await storage.getItem(STORAGE_KEYS.lastSyncTime)).toBe(now);
      expect(await storage.getItem(STORAGE_KEYS.lastSyncDirection)).toBeNull();
    });

    it('awaits the request while exposing busy state, then clears it on failure', async () => {
      const request = createDeferred<never>();
      const started = createDeferred<void>();
      mockGistsGet.mockImplementation(() => {
        started.resolve();
        return request.promise;
      });
      const syncing = triggerGistSync();
      await started.promise;

      expect((await getGistSyncStatus()).syncInProgress).toBe(true);
      expect(await triggerGistSync()).toEqual({ success: false, error: 'Sync already in progress' });
      request.reject('request failed');
      expect(await syncing).toEqual({ success: false, error: 'Unknown sync error' });
      expect(await getGistSyncStatus()).toMatchObject({ syncInProgress: false, lastError: 'Unknown sync error' });

      mockGistsGet.mockRejectedValue(new Error('404 Not Found'));
      expect(await triggerGistSync()).toEqual({ success: false, error: 'Gist not found' });
      expect((await getGistSyncStatus()).lastError).toBeNull();
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
