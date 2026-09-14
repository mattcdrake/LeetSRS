import { Octokit } from 'octokit';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fakeBrowser } from 'wxt/testing/fake-browser';
import { LEARNING_DOCUMENT_VERSION, type LearningDocument } from '@/shared/models';
import {
  readGistConnection,
  readLearningDocument,
  replaceLearningDocument,
  STORAGE_KEYS,
  writeGistConnection,
} from '@/shared/storage';
import * as gistSync from '../gist-sync';

const github = vi.hoisted(() => ({ get: vi.fn(), update: vi.fn(), create: vi.fn() }));

vi.mock('octokit', () => ({
  Octokit: vi.fn(function MockOctokit() {
    return { rest: { gists: github } };
  }),
}));

describe('whole-document Gist sync', () => {
  const now = '2026-09-13T12:00:00.000Z';
  const connection = { pat: 'secret', gistId: 'gist', enabled: true };
  const local: LearningDocument = {
    schemaVersion: LEARNING_DOCUMENT_VERSION,
    cards: {},
    stats: {},
    settings: { theme: 'dark' },
    dataUpdatedAt: '2026-09-12T12:00:00.000Z',
  };

  beforeEach(async () => {
    fakeBrowser.reset();
    vi.resetAllMocks();
    vi.useFakeTimers();
    vi.setSystemTime(new Date(now));
    await writeGistConnection(connection);
    await replaceLearningDocument(local);
    gistSync.invalidateGistSync();
    await gistSync.resetGistSyncStatus();
  });

  afterEach(() => vi.useRealTimers());

  it('saves an existing Gist connection with syncing enabled', async () => {
    github.get.mockResolvedValue({ data: { files: { 'leetsrs-backup.json': { content: 'unchecked' } } } });

    expect(await gistSync.setupGistSync({ mode: 'existing', pat: 'new-token', gistId: 'new-gist' })).toEqual({
      saved: true,
    });

    expect(Octokit).toHaveBeenCalledExactlyOnceWith({ auth: 'new-token' });
    expect(github.get).toHaveBeenCalledExactlyOnceWith({ gist_id: 'new-gist' });
    expect(await readGistConnection()).toEqual({ pat: 'new-token', gistId: 'new-gist', enabled: true });
    expect(await readLearningDocument()).toEqual(local);
    expect(await gistSync.getGistSyncStatus()).toMatchObject({ lastSyncTime: null, syncInProgress: false });
  });

  it('creates a private Gist with syncing enabled', async () => {
    github.create.mockResolvedValue({ data: { id: 'created-gist' } });

    expect(await gistSync.setupGistSync({ mode: 'create', pat: 'new-token' })).toEqual({ saved: true });

    expect(github.create).toHaveBeenCalledExactlyOnceWith({
      description: 'LeetSRS Backup - Spaced Repetition Data',
      public: false,
      files: { 'leetsrs-backup.json': { content: expect.any(String) } },
    });
    expect(JSON.parse(github.create.mock.calls[0][0].files['leetsrs-backup.json'].content)).toEqual(local);
    expect(await readGistConnection()).toEqual({ pat: 'new-token', gistId: 'created-gist', enabled: true });
    expect(github.get).not.toHaveBeenCalled();
  });

  it.each([
    ['missing backup', { mode: 'existing', pat: 'token', gistId: 'gist' } as const, 'missingBackup'],
    ['missing created ID', { mode: 'create', pat: 'token' } as const, 'creationFailed'],
  ])('keeps the previous connection when setup fails with %s', async (_name, setup, error) => {
    github.get.mockResolvedValue({ data: { files: {} } });
    github.create.mockResolvedValue({ data: {} });

    expect(await gistSync.setupGistSync(setup)).toEqual({ saved: false, error });
    expect(await readGistConnection()).toEqual(connection);
  });

  it('uses stable error codes for GitHub and storage failures', async () => {
    github.get.mockRejectedValueOnce(Object.assign(new Error('Not Found'), { status: 404 }));
    expect(await gistSync.setupGistSync({ mode: 'existing', pat: 'token', gistId: 'missing' })).toEqual({
      saved: false,
      error: 'gistNotFound',
    });

    github.get.mockResolvedValue({ data: { files: { 'leetsrs-backup.json': {} } } });
    vi.spyOn(fakeBrowser.storage.sync, 'set').mockRejectedValueOnce(new Error('disk failed'));
    expect(await gistSync.setupGistSync({ mode: 'existing', pat: 'token', gistId: 'gist' })).toEqual({
      saved: false,
      error: 'connectionSaveFailed',
    });
  });

  it.each([
    [{ pat: '' }, 'missingToken'],
    [{ gistId: null }, 'missingGist'],
  ] as const)('rejects enabling an incomplete connection', async (missing, error) => {
    await writeGistConnection({ ...connection, ...missing, enabled: false });

    expect(await gistSync.setGistSyncEnabled(true)).toEqual({ saved: false, error });
    expect((await readGistConnection()).enabled).toBe(false);
    expect(github.get).not.toHaveBeenCalled();
  });

  it('pushes the local document when it is newer', async () => {
    const remote = { ...local, settings: { theme: 'light' as const }, dataUpdatedAt: '2026-09-11T12:00:00.000Z' };
    github.get.mockResolvedValue({
      data: { files: { 'leetsrs-backup.json': { content: JSON.stringify(remote) } } },
    });
    github.update.mockResolvedValue({});

    await gistSync.triggerGistSync();

    expect(github.update).toHaveBeenCalledExactlyOnceWith({
      gist_id: 'gist',
      files: { 'leetsrs-backup.json': { content: expect.any(String) } },
    });
    expect(JSON.parse(github.update.mock.calls[0][0].files['leetsrs-backup.json'].content)).toEqual(local);
    expect(await readLearningDocument()).toEqual(local);
    expect(await gistSync.getGistSyncStatus()).toEqual({
      lastSyncTime: now,
      lastSyncDirection: 'push',
      syncInProgress: false,
      lastError: null,
    });
  });

  it('pulls the remote document when it is newer', async () => {
    const remote = { ...local, settings: { theme: 'light' as const }, dataUpdatedAt: '2026-09-14T12:00:00.000Z' };
    github.get.mockResolvedValue({
      data: { files: { 'leetsrs-backup.json': { content: JSON.stringify(remote) } } },
    });

    await gistSync.triggerGistSync();

    expect(await readLearningDocument()).toEqual(remote);
    expect(github.update).not.toHaveBeenCalled();
    expect(await gistSync.getGistSyncStatus()).toMatchObject({
      lastSyncTime: now,
      lastSyncDirection: 'pull',
      lastError: null,
    });
  });

  it('does nothing when local and remote timestamps match', async () => {
    github.get.mockResolvedValue({
      data: { files: { 'leetsrs-backup.json': { content: JSON.stringify(local) } } },
    });

    await gistSync.triggerGistSync();

    expect(github.update).not.toHaveBeenCalled();
    expect(await readLearningDocument()).toEqual(local);
    expect(await gistSync.getGistSyncStatus()).toMatchObject({ lastSyncTime: now, lastSyncDirection: null });
  });

  it('rejects an invalid remote document before overwriting either side', async () => {
    github.get.mockResolvedValue({
      data: { files: { 'leetsrs-backup.json': { content: JSON.stringify({ ...local, schemaVersion: 999 }) } } },
    });
    const writes = vi.spyOn(fakeBrowser.storage.local, 'set');

    await gistSync.triggerGistSync();

    expect(writes).not.toHaveBeenCalled();
    expect(github.update).not.toHaveBeenCalled();
    expect(await readLearningDocument()).toEqual(local);
    expect(await gistSync.getGistSyncStatus()).toMatchObject({ lastError: 'unknown', syncInProgress: false });
  });

  it.each([
    [Object.assign(new Error('Bad credentials'), { status: 401 }), 'authentication'],
    [Object.assign(new Error('rate limit'), { status: 429 }), 'rateLimit'],
    [new TypeError('Failed to fetch'), 'unavailable'],
    [new Error('unexpected'), 'unknown'],
  ] as const)('reports sync failures as %s', async (failure, error) => {
    github.get.mockRejectedValue(failure);

    await gistSync.triggerGistSync();

    expect(await gistSync.getGistSyncStatus()).toMatchObject({ lastError: error, syncInProgress: false });
    expect(await fakeBrowser.storage.local.get(STORAGE_KEYS.lastSyncTime)).toEqual({});
  });

  it('shares one in-flight sync between overlapping triggers', async () => {
    const response = Promise.withResolvers<{ data: { files: Record<string, never> } }>();
    github.get.mockReturnValue(response.promise);
    github.update.mockResolvedValue({});

    const first = gistSync.triggerGistSync();
    const second = gistSync.triggerGistSync();
    expect(second).toBe(first);
    await vi.waitFor(() => expect(github.get).toHaveBeenCalledOnce());

    response.resolve({ data: { files: {} } });
    await first;
    expect(github.update).toHaveBeenCalledOnce();
  });
});
