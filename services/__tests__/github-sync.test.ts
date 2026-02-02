import { describe, it, expect, beforeEach, vi } from 'vitest';
import { fakeBrowser } from 'wxt/testing';
import { storage } from 'wxt/utils/storage';
import { STORAGE_KEYS } from '../storage-keys';

// Mock Octokit
const mockGetAuthenticated = vi.fn();
const mockGistsGet = vi.fn();
const mockGistsCreate = vi.fn();
const mockGistsUpdate = vi.fn();

vi.mock('octokit', () => ({
  Octokit: vi.fn(() => ({
    rest: {
      users: { getAuthenticated: mockGetAuthenticated },
      gists: {
        get: mockGistsGet,
        create: mockGistsCreate,
        update: mockGistsUpdate,
      },
    },
  })),
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
  getGistSyncConfig,
  setGistSyncConfig,
  getGistSyncStatus,
  validatePat,
  validateGistId,
  createNewGist,
  triggerGistSync,
} from '../github-sync';

describe('github-sync', () => {
  beforeEach(() => {
    fakeBrowser.reset();
    fakeBrowser.runtime.id = 'test';
    vi.resetAllMocks();
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
    it('should return error for empty PAT', async () => {
      const result = await validatePat('');

      expect(result).toEqual({ valid: false, error: 'PAT is required' });
    });

    it('should return error for whitespace-only PAT', async () => {
      const result = await validatePat('   ');

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
    it('should return error for empty gist ID', async () => {
      const result = await validateGistId('', 'ghp_test');

      expect(result).toEqual({ valid: false, error: 'Gist ID is required' });
    });

    it('should return error for whitespace-only gist ID', async () => {
      const result = await validateGistId('   ', 'ghp_test');

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
});
