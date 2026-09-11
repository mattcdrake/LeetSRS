import { Octokit } from 'octokit';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fakeBrowser } from 'wxt/testing/fake-browser';
import { storage } from 'wxt/utils/storage';
import { setSchemaVersion } from '@/infrastructure/storage/migrations/runner';
import { STORAGE_KEYS } from '@/infrastructure/storage/storage-keys';
import { mixedRecordBackup } from '@/test/utils/backup-mocks';
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
    it('rejects an invalid pull without changing local data or sync metadata', async () => {
      await setSchemaVersion(2);
      const { payload, accepted } = mixedRecordBackup();
      const actual = await vi.importActual<typeof import('../import-export')>('../import-export');
      await actual.importData(JSON.stringify({ ...payload, data: accepted }));
      await storage.setItem(STORAGE_KEYS.gistId, 'gist123');
      await storage.setItem(STORAGE_KEYS.dataUpdatedAt, '2023-01-01T00:00:00.000Z');
      const before = await fakeBrowser.storage.local.get(null);
      mockImportData.mockImplementation(actual.importData);
      mockGistsGet.mockResolvedValue({
        data: { files: { 'leetsrs-backup.json': { content: JSON.stringify(payload) } } },
      });
      expect(await triggerGistSync()).toMatchObject({ success: false, error: expect.any(String) });
      expect(await fakeBrowser.storage.local.get(null)).toEqual(before);
      expect(mockGistsUpdate).not.toHaveBeenCalled();
    });

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
      const request = Promise.withResolvers<{ data: { files: Record<string, never> } }>();
      const started = Promise.withResolvers<void>();
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

    it.each([
      { name: 'missing file', files: {} },
      { name: 'missing content', files: { 'leetsrs-backup.json': {} } },
      { name: 'empty content', files: { 'leetsrs-backup.json': { content: '' } } },
      { name: 'invalid JSON', files: { 'leetsrs-backup.json': { content: '{' } } },
    ])('pushes $name without reading or initializing local metadata', async ({ files }) => {
      mockGistsGet.mockResolvedValue({ data: { files } });
      mockExportData.mockResolvedValue('local backup');
      const reads = vi.spyOn(storage, 'getItem');
      const writes = vi.spyOn(storage, 'setItem');

      expect(await triggerGistSync()).toEqual({ success: true, action: 'pushed', timestamp: now });
      expect(reads).not.toHaveBeenCalledWith(STORAGE_KEYS.dataUpdatedAt);
      expect(writes.mock.calls).toEqual([
        [STORAGE_KEYS.lastSyncTime, now],
        [STORAGE_KEYS.lastSyncDirection, 'push'],
      ]);
      expect(mockGistsUpdate).toHaveBeenCalledExactlyOnceWith({
        gist_id: 'gist123',
        files: { 'leetsrs-backup.json': { content: 'local backup' } },
      });
      expect(mockImportData).not.toHaveBeenCalled();
      expect(await storage.getItem(STORAGE_KEYS.dataUpdatedAt)).toBeNull();
    });

    it('reads local metadata after the remote response before rejecting parsed null', async () => {
      mockGistsGet.mockResolvedValue({ data: { files: { 'leetsrs-backup.json': { content: 'null' } } } });
      const reads = vi.spyOn(storage, 'getItem');
      const writes = vi.spyOn(storage, 'setItem');
      const result = await triggerGistSync();
      expect(result).toEqual({ success: false, error: expect.stringContaining('null') });
      expect(reads).toHaveBeenCalledWith(STORAGE_KEYS.dataUpdatedAt);
      expect(mockExportData).not.toHaveBeenCalled();
      expect(mockImportData).not.toHaveBeenCalled();
      expect(writes).not.toHaveBeenCalled();
      expect((await getGistSyncStatus()).syncInProgress).toBe(false);
    });

    it('uses local metadata changed while the remote read is pending', async () => {
      const request = Promise.withResolvers<{ data: { files: Record<string, { content: string }> } }>();
      const started = Promise.withResolvers<void>();
      mockGistsGet.mockImplementation(() => {
        started.resolve();
        return request.promise;
      });
      const reads = vi.spyOn(storage, 'getItem');
      const syncing = triggerGistSync();
      await started.promise;
      expect(reads).not.toHaveBeenCalledWith(STORAGE_KEYS.dataUpdatedAt);
      await storage.setItem(STORAGE_KEYS.dataUpdatedAt, later);
      request.resolve({
        data: { files: { 'leetsrs-backup.json': { content: JSON.stringify({ dataUpdatedAt: now }) } } },
      });
      mockExportData.mockResolvedValue('{}');
      expect(await syncing).toMatchObject({ success: true, action: 'pushed' });
      expect(mockImportData).not.toHaveBeenCalled();
    });

    it.each([
      '{}',
      '[]',
      'false',
      '42',
      '"text"',
      '{"dataUpdatedAt":null}',
      '{"dataUpdatedAt":0}',
      '{"dataUpdatedAt":""}',
    ])('initializes a missing legacy timestamp before exporting parsed %s', async (content) => {
      mockGistsGet.mockResolvedValue({ data: { files: { 'leetsrs-backup.json': { content } } } });
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

    it.each([
      { localTimestamp: null, remoteTimestamp: '2024-01-01T00:00:00Z' },
      { localTimestamp: '2023-12-01T00:00:00Z', remoteTimestamp: '2024-01-01T00:00:00Z' },
      { localTimestamp: null, remoteTimestamp: 'invalid' },
    ])(
      'pulls remote $remoteTimestamp with local timestamp $localTimestamp',
      async ({ localTimestamp, remoteTimestamp }) => {
        if (localTimestamp) await storage.setItem(STORAGE_KEYS.dataUpdatedAt, localTimestamp);
        const content = `{ "dataUpdatedAt": "${remoteTimestamp}", "data": {} }`;
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

    it.each([
      { local: now, remote: now },
      { local: now, remote: 'invalid' },
      { local: 'invalid', remote: now },
      { local: 'invalid', remote: 'invalid' },
      { local: now, remote: {} },
    ])('writes only sync time for local $local and remote $remote', async ({ local, remote }) => {
      await storage.setItem(STORAGE_KEYS.dataUpdatedAt, local);
      await storage.setItem(STORAGE_KEYS.lastSyncDirection, 'pull');
      mockGistsGet.mockResolvedValue({
        data: { files: { 'leetsrs-backup.json': { content: JSON.stringify({ dataUpdatedAt: remote }) } } },
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

    it.each(['export', 'push', 'pull'] as const)(
      'does not write status when %s fails and permits retry',
      async (direction) => {
        const failure = new Error('403 Forbidden');
        const content = JSON.stringify({ dataUpdatedAt: now });
        mockGistsGet.mockResolvedValue({
          data: { files: direction === 'pull' ? { 'leetsrs-backup.json': { content } } : {} },
        });
        mockExportData.mockResolvedValue('{}');
        if (direction === 'export') mockExportData.mockRejectedValueOnce(failure);
        if (direction === 'push') mockGistsUpdate.mockRejectedValueOnce(failure);
        if (direction === 'pull') mockImportData.mockRejectedValueOnce(failure);
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
        if (direction === 'export') expect(mockGistsUpdate).not.toHaveBeenCalled();
        expect(await triggerGistSync()).toMatchObject({
          success: true,
          action: direction === 'pull' ? 'pulled' : 'pushed',
        });
        expect((await getGistSyncStatus()).lastError).toBeNull();
      }
    );

    it.each([
      { direction: 'push', failedKey: STORAGE_KEYS.lastSyncTime },
      { direction: 'push', failedKey: STORAGE_KEYS.lastSyncDirection },
      { direction: 'pull', failedKey: STORAGE_KEYS.lastSyncTime },
      { direction: 'pull', failedKey: STORAGE_KEYS.lastSyncDirection },
      { direction: 'no-change', failedKey: STORAGE_KEYS.lastSyncTime },
    ])(
      'preserves partial writes when $direction fails at $failedKey and permits retry',
      async ({ direction, failedKey }) => {
        await storage.setItem(STORAGE_KEYS.lastSyncTime, 'previous-time');
        await storage.setItem(STORAGE_KEYS.lastSyncDirection, 'push');
        if (direction === 'no-change') await storage.setItem(STORAGE_KEYS.dataUpdatedAt, now);
        const content = JSON.stringify({ dataUpdatedAt: now });
        mockGistsGet.mockResolvedValue({
          data: { files: direction === 'push' ? {} : { 'leetsrs-backup.json': { content } } },
        });
        mockExportData.mockResolvedValue('{}');
        let transferred = false;
        const transfer = async () => {
          transferred = true;
          vi.setSystemTime(new Date(later));
        };
        mockGistsUpdate.mockImplementation(transfer);
        mockImportData.mockImplementation(transfer);
        const write = storage.setItem.bind(storage);
        const writes = vi.spyOn(storage, 'setItem').mockImplementation(async (key, value) => {
          expect(transferred).toBe(direction !== 'no-change');
          if (key === failedKey) throw new Error('status write failed');
          return write(key, value);
        });

        expect(await triggerGistSync()).toEqual({ success: false, error: 'status write failed' });
        const completionTime = direction === 'no-change' ? now : later;
        expect(writes.mock.calls).toEqual(
          failedKey === STORAGE_KEYS.lastSyncTime
            ? [[STORAGE_KEYS.lastSyncTime, completionTime]]
            : [
                [STORAGE_KEYS.lastSyncTime, completionTime],
                [STORAGE_KEYS.lastSyncDirection, direction],
              ]
        );
        expect(mockGistsUpdate).toHaveBeenCalledTimes(direction === 'push' ? 1 : 0);
        expect(mockImportData).toHaveBeenCalledTimes(direction === 'pull' ? 1 : 0);
        expect(await getGistSyncStatus()).toEqual({
          lastSyncTime: failedKey === STORAGE_KEYS.lastSyncTime ? 'previous-time' : completionTime,
          lastSyncDirection: 'push',
          syncInProgress: false,
          lastError: 'status write failed',
        });
        writes.mockRestore();
        expect(await triggerGistSync()).toMatchObject({ success: true });
        expect((await getGistSyncStatus()).lastError).toBeNull();
      }
    );

    it('awaits the request while exposing busy state, then clears it on failure', async () => {
      const request = Promise.withResolvers<never>();
      const started = Promise.withResolvers<void>();
      mockGistsGet.mockImplementation(() => {
        started.resolve();
        return request.promise;
      });
      const syncing = triggerGistSync();
      await started.promise;

      expect((await getGistSyncStatus()).syncInProgress).toBe(true);
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
      expect((await getGistSyncStatus()).syncInProgress).toBe(false);
    });
  });
});
