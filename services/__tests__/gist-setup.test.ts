import { Octokit } from 'octokit';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fakeBrowser } from 'wxt/testing/fake-browser';
import { storage } from 'wxt/utils/storage';
import type { GistSyncConfigUpdate } from '@/domain/gist-sync';
import { LEARNING_DOCUMENT_VERSION, type LearningDocument } from '@/domain/learning-document';
import { readGistConnection } from '@/infrastructure/storage/gist-connection';
import { readLearningDocument, replaceLearningDocument } from '@/infrastructure/storage/learning-document';
import { STORAGE_KEYS } from '@/infrastructure/storage/storage-keys';
import * as documentSetup from '../document-gist-sync';
import * as documentBackup from '../document-import-export';
import { createNewGist, setGistSyncConfig, validateGistId } from '../gist-sync';

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
    const reads = vi.spyOn(fakeBrowser.storage.sync, 'get');
    expect(await readGistConnection()).toEqual(expected);
    expect(reads).toHaveBeenCalledExactlyOnceWith('leetsrs:gistConnection');
  });

  it.each([{}, { pat: 'token', gistId: 'gist', enabled: 'false' }])(
    'rejects a malformed stored record: %j',
    async (invalid) => {
      await storage.setItem(STORAGE_KEYS.gistConnection, invalid);
      const writes = vi.spyOn(fakeBrowser.storage.sync, 'set');
      await expect(readGistConnection()).rejects.toThrow();
      await expect(setGistSyncConfig({ pat: 'replacement' })).rejects.toThrow();
      expect(writes).not.toHaveBeenCalled();
    }
  );

  it('ignores retained legacy keys after migration without falling back or dual-writing', async () => {
    const legacy = { 'leetsrs:githubPat': 'old', 'leetsrs:gistId': 'old-gist', 'leetsrs:gistSyncEnabled': true };
    await fakeBrowser.storage.sync.set(legacy);
    expect(await readGistConnection()).toEqual({ pat: '', gistId: null, enabled: false });
    await setGistSyncConfig({ pat: 'new', enabled: false });
    expect(await fakeBrowser.storage.sync.get(null)).toEqual({
      ...legacy,
      'leetsrs:gistConnection': { pat: 'new', gistId: null, enabled: false },
    });
  });

  it('persists the complete configuration without marking learning data edited', async () => {
    const config = { pat: ' token ', gistId: 'gist', enabled: true };
    const writes = vi.spyOn(fakeBrowser.storage.sync, 'set');
    await setGistSyncConfig(config);
    expect(writes).toHaveBeenCalledExactlyOnceWith({ 'leetsrs:gistConnection': config });
    expect(await readGistConnection()).toEqual(config);
    expect(await storage.getItem(STORAGE_KEYS.dataUpdatedAt)).toBeNull();
  });

  it.each([
    { pat: 'replacement', gistId: 42 },
    { pat: 'replacement', enabled: 'yes' },
  ])('rejects malformed configuration before any writes: %j', async (config) => {
    const writes = vi.spyOn(storage, 'setItem');
    await expect(setGistSyncConfig(config as unknown as GistSyncConfigUpdate)).rejects.toThrow();
    expect(writes).not.toHaveBeenCalled();
    expect(await readGistConnection()).toEqual({ pat: '', gistId: null, enabled: false });
  });

  it('ignores undefined configuration fields', async () => {
    await setGistSyncConfig({ pat: 'token', gistId: 'gist', enabled: true });
    const writes = vi.spyOn(storage, 'setItem');
    await setGistSyncConfig({ pat: undefined, gistId: undefined, enabled: undefined });
    expect(writes).not.toHaveBeenCalled();
    expect(await readGistConnection()).toEqual({ pat: 'token', gistId: 'gist', enabled: true });
  });

  it.each(['', ' \t\n'])('rejects blank Gist ID %j without acquiring a client or requesting a Gist', async (gistId) => {
    expect(await validateGistId(gistId, 'token')).toEqual({ valid: false, error: 'Gist ID is required' });
    expect(Octokit).not.toHaveBeenCalled();
    expect(getGist).not.toHaveBeenCalled();
  });

  it('validates with the exact supplied PAT without reading or changing saved credentials', async () => {
    await setGistSyncConfig({ pat: 'saved' });
    const reads = vi.spyOn(storage, 'getItem');
    const writes = vi.spyOn(storage, 'setItem');
    getGist.mockResolvedValue({ data: { files: { 'leetsrs-backup.json': {} } } });

    expect(await validateGistId(' gist ', ' token ')).toEqual({ valid: true });
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
    if (stage === 'acquisition') {
      vi.mocked(Octokit).mockImplementationOnce(function FailingOctokit() {
        throw failure;
      });
    } else {
      getGist.mockRejectedValue(failure);
    }

    expect(await validateGistId('gist', 'token')).toEqual({ valid: false, error });
    expect(getGist).toHaveBeenCalledTimes(stage === 'acquisition' ? 0 : 1);
  });

  it('propagates configuration-read failures during creation', async () => {
    await setGistSyncConfig({ pat: 'saved' });
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
      await setGistSyncConfig({ pat: 'saved' });
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

      const writes = vi.spyOn(fakeBrowser.storage.sync, 'set');
      await setGistSyncConfig(update);
      expect(writes).toHaveBeenCalledExactlyOnceWith({ 'leetsrs:gistConnection': { ...original, ...update } });

      expect(await readGistConnection()).toEqual({ ...original, ...update });
      if (update.gistId === null) expect((await readGistConnection()).gistId).toBeNull();
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
      await setGistSyncConfig({ pat: 'ghp_test' });
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
      await setGistSyncConfig({ pat: 'ghp_test' });
      await setGistSyncConfig({ gistId: 'gist123' });
    });

    afterEach(() => vi.useRealTimers());

    it('retains the created destination and previous status when saving status fails', async () => {
      exportData.mockResolvedValue('{}');
      create.mockResolvedValue({ data: { id: 'created' } });
      await storage.setItem(STORAGE_KEYS.lastSyncTime, 'previous-time');
      await storage.setItem(STORAGE_KEYS.lastSyncDirection, 'pull');
      vi.spyOn(fakeBrowser.storage.local, 'set').mockRejectedValueOnce(new Error('status failed'));

      await expect(createNewGist()).rejects.toThrow('status failed');

      expect(create).toHaveBeenCalledOnce();
      expect((await readGistConnection()).gistId).toBe('created');
      expect(await storage.getItem(STORAGE_KEYS.lastSyncTime)).toBe('previous-time');
      expect(await storage.getItem(STORAGE_KEYS.lastSyncDirection)).toBe('pull');
    });

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
      expect((await readGistConnection()).gistId).toBe('created');
      expect(await storage.getItem(STORAGE_KEYS.lastSyncTime)).toBe(now);
      expect(await storage.getItem(STORAGE_KEYS.lastSyncDirection)).toBe('push');
    });

    it('preserves the complete connection when an update fails and permits retry', async () => {
      const writes = vi.spyOn(storage, 'setItem').mockRejectedValueOnce(new Error('write failed'));
      const update = { pat: 'new-pat', gistId: null, enabled: true };
      await expect(setGistSyncConfig(update)).rejects.toThrow('write failed');
      expect(await readGistConnection()).toEqual({ pat: 'ghp_test', gistId: 'gist123', enabled: false });
      expect(writes).toHaveBeenCalledExactlyOnceWith(STORAGE_KEYS.gistConnection, update);
      await setGistSyncConfig(update);
      expect(await readGistConnection()).toEqual(update);
    });
  });
});

// Prepared Gist creation uses the same document as file export and sync.
describe('document Gist creation', () => {
  const document: LearningDocument = {
    schemaVersion: LEARNING_DOCUMENT_VERSION,
    cards: {},
    stats: {},
    settings: { language: 'zh-CN', theme: 'dark' },
  };

  beforeEach(async () => {
    fakeBrowser.reset();
    await setGistSyncConfig({ pat: 'private-pat', enabled: true });
    await replaceLearningDocument(document);
    // The description must follow the document language, not a stale override.
    await storage.setItem(STORAGE_KEYS.language, 'en');
    create.mockResolvedValue({ data: { id: 'created' } });
  });

  it('creates a localized secret Gist with the exported document and retains an absent edit timestamp', async () => {
    const reads = vi.spyOn(storage, 'getItem');
    await expect(documentSetup.createNewGist()).resolves.toEqual({ gistId: 'created' });
    expect(reads.mock.calls.filter(([key]) => key === STORAGE_KEYS.learningDocument)).toHaveLength(1);
    expect(create).toHaveBeenCalledExactlyOnceWith({
      description: 'LeetSRS 备份 - 间隔重复数据',
      public: false,
      files: { 'leetsrs-backup.json': { content: await documentBackup.exportData() } },
    });
    expect(await readGistConnection()).toEqual({ pat: 'private-pat', gistId: 'created', enabled: true });
    expect(await readLearningDocument()).toEqual(document);
    expect(await storage.getItem(STORAGE_KEYS.lastSyncDirection)).toBe('push');
  });

  it('retains both previous status fields and the created destination when status persistence fails', async () => {
    await storage.setItem(STORAGE_KEYS.lastSyncTime, 'previous-sync');
    await storage.setItem(STORAGE_KEYS.lastSyncDirection, 'pull');
    const write = fakeBrowser.storage.local.set.bind(fakeBrowser.storage.local);
    vi.spyOn(fakeBrowser.storage.local, 'set').mockImplementation(async (items) => {
      if ('leetsrs:lastSyncDirection' in items) {
        throw new Error('status failed');
      }
      await write(items);
    });

    await expect(documentSetup.createNewGist()).rejects.toThrow('status failed');
    expect(await readGistConnection()).toEqual({ pat: 'private-pat', gistId: 'created', enabled: true });
    expect(await readLearningDocument()).toEqual(document);
    expect(await storage.getItem(STORAGE_KEYS.lastSyncTime)).toBe('previous-sync');
    expect(await storage.getItem(STORAGE_KEYS.lastSyncDirection)).toBe('pull');
    expect(create).toHaveBeenCalledOnce();
  });
});
