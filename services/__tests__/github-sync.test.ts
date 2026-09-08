import { Octokit } from 'octokit';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fakeBrowser } from 'wxt/testing/fake-browser';
import { storage } from 'wxt/utils/storage';
import { STORAGE_KEYS } from '@/infrastructure/storage/storage-keys';
import { createDeferred } from '@/test/utils/deferred';
import { getGistSyncStatus, triggerGistSync } from '../github-sync';

// Mock Octokit
const mockGetAuthenticated = vi.fn();
const mockGistsGet = vi.fn();
const mockGistsUpdate = vi.fn();

vi.mock('octokit', () => ({
  Octokit: vi.fn(function MockOctokit() {
    return {
      rest: {
        users: { getAuthenticated: mockGetAuthenticated },
        gists: {
          get: mockGistsGet,
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

describe('github-sync', () => {
  beforeEach(() => {
    fakeBrowser.reset();
    fakeBrowser.runtime.id = 'test';
    vi.resetAllMocks();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it.each([null, '2024-01-15T10:00:00Z'])('reads persisted sync status (%s)', async (timestamp) => {
    if (timestamp) {
      await storage.setItem(STORAGE_KEYS.lastSyncTime, timestamp);
      await storage.setItem(STORAGE_KEYS.lastSyncDirection, 'push');
    }
    expect(await getGistSyncStatus()).toMatchObject({
      lastSyncTime: timestamp,
      lastSyncDirection: timestamp ? 'push' : null,
    });
  });

  describe('triggerGistSync', () => {
    beforeEach(async () => {
      await storage.setItem(STORAGE_KEYS.githubPat, 'ghp_test');
      await storage.setItem(STORAGE_KEYS.gistId, 'gist123');
    });

    it.each([
      [STORAGE_KEYS.githubPat, 'PAT is not configured'],
      [STORAGE_KEYS.gistId, 'Gist ID is not configured'],
    ])('rejects missing configuration at %s', async (key, error) => {
      await storage.removeItem(key);
      expect(await triggerGistSync()).toEqual({ success: false, error });
      expect(Octokit).not.toHaveBeenCalled();
    });

    it.each([
      { name: 'missing file', content: undefined },
      { name: 'invalid JSON', content: 'not valid json' },
      { name: 'missing remote timestamp', content: '{"data":{}}' },
      { name: 'older remote timestamp', content: '{"dataUpdatedAt":"2024-01-15T10:00:00Z"}' },
    ])('pushes for $name', async ({ content }) => {
      await storage.setItem(STORAGE_KEYS.dataUpdatedAt, '2024-01-15T12:00:00Z');
      mockGistsGet.mockResolvedValue({
        data: { files: content === undefined ? {} : { 'leetsrs-backup.json': { content } } },
      });
      mockExportData.mockResolvedValue('{"local":"data"}');
      mockGistsUpdate.mockResolvedValue({});

      expect(await triggerGistSync()).toMatchObject({ success: true, action: 'pushed' });
      expect(mockGistsUpdate).toHaveBeenCalledExactlyOnceWith({
        gist_id: 'gist123',
        files: { 'leetsrs-backup.json': { content: '{"local":"data"}' } },
      });
      expect(await storage.getItem(STORAGE_KEYS.lastSyncDirection)).toBe('push');
      expect(mockImportData).not.toHaveBeenCalled();
    });

    it.each([
      ['404 Not Found', 'Gist not found'],
      ['403 rate limit exceeded', 'GitHub API rate limit exceeded. Please try again later.'],
      ['Unexpected server error', 'Unexpected server error'],
    ])('reports remote read error %s', async (message, error) => {
      mockGistsGet.mockRejectedValue(new Error(message));
      expect(await triggerGistSync()).toEqual({ success: false, error });
    });

    describe('concurrent sync prevention', () => {
      it('prevents concurrent syncs and permits another after completion', async () => {
        const request = createDeferred<{ data: { files: Record<string, never> } }>();
        mockGistsGet.mockReturnValue(request.promise);
        mockExportData.mockResolvedValue('{}');
        mockGistsUpdate.mockResolvedValue({});

        // Start first sync
        const firstSync = triggerGistSync();

        // Immediately try second sync
        const secondSync = await triggerGistSync();

        expect(secondSync).toEqual({ success: false, error: 'Sync already in progress' });

        request.resolve({ data: { files: {} } });
        expect(await firstSync).toMatchObject({ success: true, action: 'pushed' });
        expect(await triggerGistSync()).toMatchObject({ success: true, action: 'pushed' });
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

    it('retains one client and destination when credentials change during the remote read', async () => {
      const request = createDeferred<{ data: { files: Record<string, never> } }>();
      const started = createDeferred<void>();
      mockGistsGet.mockImplementation(() => {
        started.resolve();
        return request.promise;
      });
      mockExportData.mockResolvedValue('{"snapshot":true}');
      mockGistsUpdate.mockResolvedValue({});

      const syncing = triggerGistSync();
      await started.promise;
      await storage.setItem(STORAGE_KEYS.githubPat, 'replacement');
      await storage.setItem(STORAGE_KEYS.gistId, 'replacement-gist');
      request.resolve({ data: { files: {} } });
      expect(await syncing).toMatchObject({ success: true, action: 'pushed' });

      expect(Octokit).toHaveBeenCalledExactlyOnceWith({ auth: 'ghp_test' });
      expect(mockGetAuthenticated).not.toHaveBeenCalled();
      expect(mockGistsGet).toHaveBeenCalledExactlyOnceWith({ gist_id: 'gist123' });
      expect(mockGistsUpdate).toHaveBeenCalledExactlyOnceWith({
        gist_id: 'gist123',
        files: { 'leetsrs-backup.json': { content: '{"snapshot":true}' } },
      });
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

    it.each([null, '2023-12-01T00:00:00Z'])(
      'pulls newer remote data with local timestamp %s',
      async (localTimestamp) => {
        if (localTimestamp) await storage.setItem(STORAGE_KEYS.dataUpdatedAt, localTimestamp);
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
      }
    );

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

      mockGistsGet.mockResolvedValue({ data: { files: {} } });
      mockExportData.mockResolvedValue('{}');
      mockGistsUpdate.mockResolvedValue({});
      expect(await triggerGistSync()).toMatchObject({ success: true, action: 'pushed' });
    });
  });
});
