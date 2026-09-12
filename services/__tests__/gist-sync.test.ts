import { Octokit } from 'octokit';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fakeBrowser } from 'wxt/testing/fake-browser';
import { storage } from 'wxt/utils/storage';
import { LEARNING_DOCUMENT_VERSION, type LearningDocument } from '@/domain/learning-document';
import { parseBackup } from '@/infrastructure/storage/backup';
import { readGistConnection } from '@/infrastructure/storage/gist-connection';
import { readLearningDocument, replaceLearningDocument } from '@/infrastructure/storage/learning-document';
import { setSchemaVersion } from '@/infrastructure/storage/migrations/runner';
import { STORAGE_KEYS } from '@/infrastructure/storage/storage-keys';
import { setGistSyncConfig } from '@/services/gist-sync';
import { mixedRecordBackup } from '@/test/utils/backup-mocks';
import * as documentSync from '../document-gist-sync';
import * as documentBackup from '../document-import-export';
import { getGistSyncStatus, triggerGistSync } from '../gist-sync';

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

describe('gist-sync', () => {
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
    it.each(['records', 'declared version'])(
      'rejects invalid %s on pull without changing local data or sync metadata',
      async (kind) => {
        await setSchemaVersion(2);
        const { payload, accepted } = mixedRecordBackup();
        const actual = await vi.importActual<typeof import('../import-export')>('../import-export');
        await actual.importData(JSON.stringify({ ...payload, data: accepted }));
        await setGistSyncConfig({ gistId: 'gist123' });
        await storage.setItem(STORAGE_KEYS.dataUpdatedAt, '2023-01-01T00:00:00.000Z');
        const before = await fakeBrowser.storage.local.get(null);
        const syncBefore = await fakeBrowser.storage.sync.get(null);
        const invalid =
          kind === 'records'
            ? payload
            : {
                ...payload,
                schemaVersion: 3,
                data: { ...accepted, settings: { autoClearLeetcode: true, resetEditorOnEveryProblem: false } },
              };
        mockImportData.mockImplementation(actual.importData);
        mockGistsGet.mockResolvedValue({
          data: { files: { 'leetsrs-backup.json': { content: JSON.stringify(invalid) } } },
        });
        expect(await triggerGistSync()).toMatchObject({ success: false, error: expect.any(String) });
        expect(await fakeBrowser.storage.local.get(null)).toEqual(before);
        expect(await fakeBrowser.storage.sync.get(null)).toEqual(syncBefore);
        expect(mockGistsUpdate).not.toHaveBeenCalled();
      }
    );

    it('preserves the prepared replacement when pulling a historical Gist backup', async () => {
      const { payload, accepted } = mixedRecordBackup();
      const json = JSON.stringify({
        ...payload,
        data: {
          ...accepted,
          settings: { autoClearLeetcode: false, dayStartHour: 4, theme: 'dark' },
          gistSync: { gistId: 'incoming-gist', enabled: false },
        },
      });
      const prepared = parseBackup(json);
      const actual = await vi.importActual<typeof import('../import-export')>('../import-export');
      mockImportData.mockImplementation(actual.importData);
      await storage.setItem(STORAGE_KEYS.dataUpdatedAt, '2023-01-01T00:00:00.000Z');
      mockGistsGet.mockResolvedValue({ data: { files: { 'leetsrs-backup.json': { content: json } } } });

      expect(await triggerGistSync()).toMatchObject({ success: true, action: 'pulled' });
      const { dataUpdatedAt, ...data } = prepared;
      expect(JSON.parse(await actual.exportData())).toMatchObject({ data, dataUpdatedAt });
      expect((await readGistConnection()).pat).toBe('ghp_test');
    });

    beforeEach(async () => {
      await setGistSyncConfig({ pat: 'ghp_test' });
      await setGistSyncConfig({ gistId: 'gist123' });
    });

    it.each([
      [{ pat: '' }, 'PAT is not configured'],
      [{ gistId: null }, 'Gist ID is not configured'],
    ] as const)('rejects missing configuration %j', async (config, error) => {
      await setGistSyncConfig(config);
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
      await setGistSyncConfig({ pat: 'ghp_test' });
      await setGistSyncConfig({ gistId: 'gist123' });
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
      await setGistSyncConfig({ pat: 'replacement' });
      await setGistSyncConfig({ gistId: 'replacement-gist' });
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

// Prepared workflows move to registered commands and alarms at activation in #378.
describe('document Gist sync', () => {
  const now = '2024-02-01T12:00:00.000Z';
  const timestamp = '2024-01-15T10:00:00.000Z';
  const connection = { pat: 'ghp_test', gistId: 'gist123', enabled: false };
  const local: LearningDocument = {
    schemaVersion: LEARNING_DOCUMENT_VERSION,
    cards: {},
    stats: {},
    settings: { theme: 'dark' },
    dataUpdatedAt: now,
  };

  beforeEach(async () => {
    fakeBrowser.reset();
    vi.resetAllMocks();
    const get = fakeBrowser.storage.local.get.bind(fakeBrowser.storage.local);
    vi.spyOn(fakeBrowser.storage.local, 'get').mockImplementation(async (keys) => structuredClone(await get(keys)));
    vi.useFakeTimers();
    vi.setSystemTime(new Date(now));
    await setGistSyncConfig(connection);
    await replaceLearningDocument(local);
    await storage.setItem(STORAGE_KEYS.lastSyncTime, 'previous-sync');
    await storage.setItem(STORAGE_KEYS.lastSyncDirection, 'pull');
  });

  afterEach(() => vi.useRealTimers());

  it('pushes one captured document with settings while retaining the local edit timestamp', async () => {
    mockGistsGet.mockResolvedValue({
      data: { files: { 'leetsrs-backup.json': { content: JSON.stringify({ ...local, dataUpdatedAt: timestamp }) } } },
    });
    const reads = vi.spyOn(storage, 'getItem');
    expect(await documentSync.triggerGistSync()).toEqual({ success: true, action: 'pushed', timestamp: now });
    expect(reads.mock.calls.filter(([key]) => key === STORAGE_KEYS.learningDocument)).toHaveLength(1);
    const json = await documentBackup.exportData();
    expect(mockGistsUpdate).toHaveBeenCalledExactlyOnceWith({
      gist_id: 'gist123',
      files: { 'leetsrs-backup.json': { content: json } },
    });
    expect(JSON.parse(json)).toEqual(local);
    expect(await readGistConnection()).toEqual(connection);
    expect(await documentSync.getGistSyncStatus()).toEqual({
      lastSyncTime: now,
      lastSyncDirection: 'push',
      syncInProgress: false,
      lastError: null,
    });
  });

  it.each(['current', 'historical'])(
    'pulls a %s backup into an unedited document without changing the connection',
    async (format) => {
      const { accepted, embedded } = mixedRecordBackup();
      await replaceLearningDocument({ ...local, ...embedded, dataUpdatedAt: undefined });
      const remote =
        format === 'current'
          ? { ...local, settings: {}, dataUpdatedAt: timestamp }
          : {
              schemaVersion: 2,
              exportDate: timestamp,
              data: {
                ...accepted,
                settings: { autoClearLeetcode: false, theme: 'light' },
                gistSync: { gistId: 'incoming-gist', enabled: true, pat: 'incoming-pat' },
              },
            };
      mockGistsGet.mockResolvedValue({
        data: { files: { 'leetsrs-backup.json': { content: JSON.stringify(remote) } } },
      });
      const writes = vi.spyOn(storage, 'setItem');
      expect(await documentSync.triggerGistSync()).toEqual({ success: true, action: 'pulled', timestamp: now });
      expect(JSON.parse(await documentBackup.exportData())).toEqual({
        schemaVersion: LEARNING_DOCUMENT_VERSION,
        ...(format === 'current' ? { cards: {}, stats: {} } : embedded),
        settings: format === 'current' ? {} : { resetEditorOnEveryProblem: false, theme: 'light' },
        dataUpdatedAt: timestamp,
      });
      expect(writes.mock.calls.filter(([key]) => key === STORAGE_KEYS.learningDocument)).toHaveLength(1);
      expect(await readGistConnection()).toEqual(connection);
      expect(mockGistsUpdate).not.toHaveBeenCalled();
      expect(await documentSync.getGistSyncStatus()).toMatchObject({ lastSyncTime: now, lastSyncDirection: 'pull' });
      // A second sync sees equal timestamps; conversion did not make a new edit.
      expect(await documentSync.triggerGistSync()).toMatchObject({ success: true, action: 'no-change' });
      expect(mockGistsUpdate).not.toHaveBeenCalled();
    }
  );

  it.each([
    { name: 'missing file', files: {} },
    {
      name: 'unedited remote',
      files: { 'leetsrs-backup.json': { content: JSON.stringify({ ...local, dataUpdatedAt: undefined }) } },
    },
  ])('pushes $name without manufacturing an edit timestamp', async ({ files }) => {
    await replaceLearningDocument({ ...local, dataUpdatedAt: undefined });
    mockGistsGet.mockResolvedValue({ data: { files } });
    expect(await documentSync.triggerGistSync()).toMatchObject({ success: true, action: 'pushed' });
    const pushed = JSON.parse(mockGistsUpdate.mock.calls[0][0].files['leetsrs-backup.json'].content);
    expect(pushed).toEqual({
      schemaVersion: LEARNING_DOCUMENT_VERSION,
      cards: {},
      stats: {},
      settings: { theme: 'dark' },
    });
    expect(await readLearningDocument()).not.toHaveProperty('dataUpdatedAt', expect.any(String));
  });

  it.each([
    ['missing content in an existing file', undefined],
    ['empty existing file', ''],
    ['invalid JSON', '{'],
    ['null', 'null'],
    ['malformed current document', JSON.stringify({ ...local, cards: { invalid: {} }, dataUpdatedAt: timestamp })],
    [
      'future document',
      JSON.stringify({ ...local, schemaVersion: LEARNING_DOCUMENT_VERSION + 1, dataUpdatedAt: timestamp }),
    ],
    ['invalid timestamp', JSON.stringify({ ...local, dataUpdatedAt: 'invalid' })],
    [
      'malformed historical backup',
      JSON.stringify({
        schemaVersion: 2,
        exportDate: timestamp,
        data: { cards: {}, stats: {}, settings: { theme: 'invalid' } },
      }),
    ],
  ])('rejects %s before a newer local document can overwrite the remote', async (_name, content) => {
    mockGistsGet.mockResolvedValue({ data: { files: { 'leetsrs-backup.json': { content } } } });
    const writes = vi.spyOn(storage, 'setItem');
    expect(await documentSync.triggerGistSync()).toMatchObject({ success: false, error: expect.any(String) });
    expect(writes).not.toHaveBeenCalled();
    expect(mockGistsUpdate).not.toHaveBeenCalled();
    expect(await readLearningDocument()).toEqual(local);
    expect(await readGistConnection()).toEqual(connection);
    expect(await documentSync.getGistSyncStatus()).toMatchObject({
      lastSyncTime: 'previous-sync',
      lastSyncDirection: 'pull',
      syncInProgress: false,
      lastError: expect.any(String),
    });
  });

  it('retains the document and previous status after a rejected pull replacement, then retries', async () => {
    const remote = { ...local, settings: { language: 'zh-CN' }, dataUpdatedAt: '2025-01-01' };
    mockGistsGet.mockResolvedValue({ data: { files: { 'leetsrs-backup.json': { content: JSON.stringify(remote) } } } });
    vi.spyOn(storage, 'setItem').mockRejectedValueOnce(new Error('replacement failed'));
    expect(await documentSync.triggerGistSync()).toEqual({ success: false, error: 'replacement failed' });
    expect(await readLearningDocument()).toEqual(local);
    expect(await readGistConnection()).toEqual(connection);
    expect(await documentSync.getGistSyncStatus()).toMatchObject({
      lastSyncTime: 'previous-sync',
      lastSyncDirection: 'pull',
      syncInProgress: false,
    });
    expect(await documentSync.triggerGistSync()).toMatchObject({ success: true, action: 'pulled' });
    expect(await readLearningDocument()).toEqual(remote);
    expect((await documentSync.getGistSyncStatus()).lastError).toBeNull();
    expect(mockGistsUpdate).not.toHaveBeenCalled();
  });

  it('awaits network work, retains the captured connection, and retries a failed push', async () => {
    const request = Promise.withResolvers<{ data: { files: Record<string, never> } }>();
    const started = Promise.withResolvers<void>();
    mockGistsGet.mockImplementationOnce(() => {
      started.resolve();
      return request.promise;
    });
    mockGistsUpdate.mockRejectedValueOnce(new Error('403 rate limit exceeded'));
    const syncing = documentSync.triggerGistSync();
    await started.promise;
    expect((await documentSync.getGistSyncStatus()).syncInProgress).toBe(true);
    await setGistSyncConfig({ pat: 'replacement-pat', gistId: 'replacement-gist' });
    request.resolve({ data: { files: {} } });
    expect(await syncing).toEqual({ success: false, error: 'GitHub API rate limit exceeded. Please try again later.' });
    expect(mockGistsUpdate.mock.calls[0][0].gist_id).toBe('gist123');
    expect(Octokit).toHaveBeenCalledExactlyOnceWith({ auth: 'ghp_test' });
    expect(await readLearningDocument()).toEqual(local);
    expect(await documentSync.getGistSyncStatus()).toMatchObject({
      lastSyncTime: 'previous-sync',
      syncInProgress: false,
    });
    mockGistsGet.mockResolvedValue({ data: { files: {} } });
    expect(await documentSync.triggerGistSync()).toMatchObject({ success: true, action: 'pushed' });
    expect(mockGistsUpdate.mock.calls[1][0].gist_id).toBe('replacement-gist');
    expect((await documentSync.getGistSyncStatus()).lastError).toBeNull();
  });

  it.each([
    [{ pat: '' }, 'PAT is not configured'],
    [{ gistId: null }, 'Gist ID is not configured'],
  ] as const)('rejects missing configuration %j', async (config, error) => {
    await setGistSyncConfig(config);
    expect(await documentSync.triggerGistSync()).toEqual({ success: false, error });
    expect(mockGistsGet).not.toHaveBeenCalled();
  });

  it('reports a missing Gist without replacing either dataset', async () => {
    mockGistsGet.mockRejectedValue(new Error('404 Not Found'));
    expect(await documentSync.triggerGistSync()).toEqual({ success: false, error: 'Gist not found' });
    expect(mockGistsUpdate).not.toHaveBeenCalled();
    expect(await readLearningDocument()).toEqual(local);
  });

  it.each(['push', 'pull', 'no-change'] as const)(
    'retains the complete prior status when saving status after %s fails',
    async (action) => {
      const remote = { ...local, settings: { theme: 'light' }, dataUpdatedAt: action === 'pull' ? '2025-01-01' : now };
      mockGistsGet.mockResolvedValue({
        data: {
          files:
            action === 'push'
              ? {}
              : {
                  'leetsrs-backup.json': { content: JSON.stringify(remote) },
                },
        },
      });
      const write = fakeBrowser.storage.local.set.bind(fakeBrowser.storage.local);
      const writes = vi.spyOn(fakeBrowser.storage.local, 'set').mockImplementation(async (items) => {
        const failedKey = action === 'no-change' ? 'leetsrs:lastSyncTime' : 'leetsrs:lastSyncDirection';
        if (failedKey in items) {
          throw new Error('status failed');
        }
        await write(items);
      });
      expect(await documentSync.triggerGistSync()).toEqual({ success: false, error: 'status failed' });
      expect(await documentSync.getGistSyncStatus()).toEqual({
        lastSyncTime: 'previous-sync',
        lastSyncDirection: 'pull',
        syncInProgress: false,
        lastError: 'status failed',
      });
      // A status failure does not roll back a completed data transfer.
      expect(await readLearningDocument()).toEqual(action === 'pull' ? remote : local);
      expect(mockGistsUpdate).toHaveBeenCalledTimes(action === 'push' ? 1 : 0);
      expect(await readGistConnection()).toEqual(connection);
      writes.mockRestore();
      expect(await documentSync.triggerGistSync()).toMatchObject({ success: true });
      expect(await documentSync.getGistSyncStatus()).toMatchObject({ lastSyncTime: now, lastError: null });
    }
  );
});
