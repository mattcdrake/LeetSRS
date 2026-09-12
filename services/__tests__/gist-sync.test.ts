import { Octokit } from 'octokit';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fakeBrowser } from 'wxt/testing/fake-browser';
import { storage } from 'wxt/utils/storage';
import { LEARNING_DOCUMENT_VERSION, type LearningDocument } from '@/domain/learning-document';
import { readGistConnection } from '@/infrastructure/storage/gist-connection';
import { readLearningDocument, replaceLearningDocument } from '@/infrastructure/storage/learning-document';
import { STORAGE_KEYS } from '@/infrastructure/storage/storage-keys';
import { setGistSyncConfig } from '@/services/gist-sync';
import { mixedRecordBackup } from '@/test/utils/backup-mocks';
import * as documentSync from '../gist-sync';
import * as documentBackup from '../import-export';

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
