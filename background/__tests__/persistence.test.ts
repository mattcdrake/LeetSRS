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
import * as persistence from '../persistence';

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
    reviewActivity: null,
    settings: { theme: 'dark' },
    dataUpdatedAt: '2026-09-12T12:00:00.000Z',
  };

  beforeEach(async () => {
    fakeBrowser.reset();
    vi.resetAllMocks();
    vi.useFakeTimers();
    vi.setSystemTime(new Date(now));
    await persistence.resetAllData();
    await writeGistConnection(connection);
    await replaceLearningDocument(local);
  });

  afterEach(() => vi.useRealTimers());

  it('saves an existing Gist connection and starts syncing without installation', async () => {
    github.get.mockResolvedValue({ data: { files: { 'leetsrs-backup.json': { content: JSON.stringify(local) } } } });

    expect(await persistence.connectGist({ mode: 'existing', pat: 'new-token', gistId: 'new-gist' })).toEqual({
      saved: true,
    });

    await vi.waitFor(() => expect(github.get).toHaveBeenCalledTimes(2));
    await vi.waitFor(async () => expect(await persistence.getSyncStatus()).toMatchObject({ syncInProgress: false }));
    expect(Octokit).toHaveBeenCalledWith({ auth: 'new-token' });
    expect(github.get).toHaveBeenCalledWith({ gist_id: 'new-gist' });
    expect(await readGistConnection()).toEqual({ pat: 'new-token', gistId: 'new-gist', enabled: true });
    expect(await readLearningDocument()).toEqual(local);
    expect(await persistence.getSyncStatus()).toMatchObject({
      lastSyncTime: expect.any(String),
      syncInProgress: false,
    });
  });

  it('creates a private Gist with syncing enabled', async () => {
    github.create.mockResolvedValue({ data: { id: 'created-gist' } });
    github.get.mockResolvedValue({ data: { files: {} } });

    expect(await persistence.connectGist({ mode: 'create', pat: 'new-token' })).toEqual({ saved: true });

    expect(github.create).toHaveBeenCalledExactlyOnceWith({
      description: 'LeetSRS Backup - Spaced Repetition Data',
      public: false,
      files: { 'leetsrs-backup.json': { content: expect.any(String) } },
    });
    expect(JSON.parse(github.create.mock.calls[0][0].files['leetsrs-backup.json'].content)).toEqual(local);
    expect(await readGistConnection()).toEqual({ pat: 'new-token', gistId: 'created-gist', enabled: true });
    await vi.waitFor(() => expect(github.get).toHaveBeenCalledExactlyOnceWith({ gist_id: 'created-gist' }));
    await vi.waitFor(async () => expect(await persistence.getSyncStatus()).toMatchObject({ syncInProgress: false }));
  });

  it.each([
    ['missing backup', { mode: 'existing', pat: 'token', gistId: 'gist' } as const, 'missingBackup'],
    ['missing created ID', { mode: 'create', pat: 'token' } as const, 'creationFailed'],
  ])('keeps the previous connection when setup fails with %s', async (_name, setup, error) => {
    github.get.mockResolvedValue({ data: { files: {} } });
    github.create.mockResolvedValue({ data: {} });

    expect(await persistence.connectGist(setup)).toEqual({ saved: false, error });
    expect(await readGistConnection()).toEqual(connection);
  });

  it('uses stable error codes for GitHub and storage failures', async () => {
    github.get.mockRejectedValueOnce(Object.assign(new Error('Not Found'), { status: 404 }));
    expect(await persistence.connectGist({ mode: 'existing', pat: 'token', gistId: 'missing' })).toEqual({
      saved: false,
      error: 'gistNotFound',
    });

    github.get.mockResolvedValue({ data: { files: { 'leetsrs-backup.json': {} } } });
    vi.spyOn(fakeBrowser.storage.sync, 'set').mockRejectedValueOnce(new Error('disk failed'));
    expect(await persistence.connectGist({ mode: 'existing', pat: 'token', gistId: 'gist' })).toEqual({
      saved: false,
      error: 'connectionSaveFailed',
    });
  });

  it.each([
    [{ pat: '' }, 'missingToken'],
    [{ gistId: null }, 'missingGist'],
  ] as const)('rejects enabling an incomplete connection', async (missing, error) => {
    await writeGistConnection({ ...connection, ...missing, enabled: false });

    expect(await persistence.setSyncEnabled(true)).toEqual({ saved: false, error });
    expect((await readGistConnection()).enabled).toBe(false);
    expect(github.get).not.toHaveBeenCalled();
  });

  it('enables sync without installing connection observation and stops it when disabled', async () => {
    await writeGistConnection({ ...connection, enabled: false });
    github.get.mockResolvedValue({ data: { files: {} } });

    expect(await persistence.setSyncEnabled(true)).toEqual({ saved: true });
    await vi.waitFor(() => expect(github.update).toHaveBeenCalledOnce());
    await vi.waitFor(async () => expect(await persistence.getSyncStatus()).toMatchObject({ syncInProgress: false }));
    expect(await persistence.setSyncEnabled(false)).toEqual({ saved: true });
    await persistence.sync();
    expect(github.get).toHaveBeenCalledOnce();
  });

  it('does not request sync when saving an edit fails', async () => {
    vi.spyOn(fakeBrowser.storage.local, 'set').mockRejectedValueOnce(new Error('disk failed'));

    await expect(persistence.saveEdit(local, new Date(now))).rejects.toThrow('disk failed');

    expect(await readLearningDocument()).toEqual(local);
    expect(github.get).not.toHaveBeenCalled();
  });

  it('pushes the local document when it is newer', async () => {
    const remote = { ...local, settings: { theme: 'light' as const }, dataUpdatedAt: '2026-09-11T12:00:00.000Z' };
    github.get.mockResolvedValue({
      data: { files: { 'leetsrs-backup.json': { content: JSON.stringify(remote) } } },
    });
    github.update.mockResolvedValue({});

    await persistence.sync();

    expect(github.update).toHaveBeenCalledExactlyOnceWith({
      gist_id: 'gist',
      files: { 'leetsrs-backup.json': { content: expect.any(String) } },
    });
    expect(JSON.parse(github.update.mock.calls[0][0].files['leetsrs-backup.json'].content)).toEqual(local);
    expect(await readLearningDocument()).toEqual(local);
    expect(await persistence.getSyncStatus()).toEqual({
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

    await persistence.sync();

    expect(await readLearningDocument()).toEqual(remote);
    expect(github.update).not.toHaveBeenCalled();
    expect(await persistence.getSyncStatus()).toMatchObject({
      lastSyncTime: now,
      lastSyncDirection: 'pull',
      lastError: null,
    });
  });

  it.each([
    { localTime: undefined, remoteTime: undefined, direction: 'push' },
    { localTime: '2026-09-12T12:00:00.000Z', remoteTime: undefined, direction: 'push' },
    { localTime: undefined, remoteTime: '2026-09-12T12:00:00.000Z', direction: 'pull' },
    { localTime: '2026-09-12T12:00:00.000Z', remoteTime: '2026-09-12T12:00:00.000Z', direction: null },
    { localTime: '2026-09-12T12:00:00.000Z', remoteTime: '2026-09-12T04:00:00-08:00', direction: null },
  ])(
    'handles local $localTime and remote $remoteTime with direction $direction',
    async ({ localTime, remoteTime, direction }) => {
      const document = { ...local, dataUpdatedAt: localTime };
      const remote = { ...local, settings: { theme: 'light' as const }, dataUpdatedAt: remoteTime };
      await replaceLearningDocument(document);
      github.get.mockResolvedValue({
        data: { files: { 'leetsrs-backup.json': { content: JSON.stringify(remote) } } },
      });

      await persistence.sync();

      if (direction === 'push') {
        expect(github.update).toHaveBeenCalledExactlyOnceWith({
          gist_id: 'gist',
          files: { 'leetsrs-backup.json': { content: expect.any(String) } },
        });
        expect(JSON.parse(github.update.mock.calls[0][0].files['leetsrs-backup.json'].content)).toEqual(document);
      } else {
        expect(github.update).not.toHaveBeenCalled();
      }
      expect(await readLearningDocument()).toEqual(direction === 'pull' ? remote : document);
      expect(await persistence.getSyncStatus()).toMatchObject({
        lastSyncTime: now,
        lastSyncDirection: direction,
        lastError: null,
      });
    }
  );

  it.each([{ schemaVersion: 999 }, { dataUpdatedAt: 'invalid' }])(
    'rejects an invalid remote document %j before overwriting either side',
    async (invalid) => {
      github.get.mockResolvedValue({
        data: { files: { 'leetsrs-backup.json': { content: JSON.stringify({ ...local, ...invalid }) } } },
      });
      const writes = vi.spyOn(fakeBrowser.storage.local, 'set');

      await persistence.sync();

      expect(writes).not.toHaveBeenCalled();
      expect(github.update).not.toHaveBeenCalled();
      expect(await readLearningDocument()).toEqual(local);
      expect(await persistence.getSyncStatus()).toMatchObject({ lastError: 'unknown', syncInProgress: false });
    }
  );

  it.each([
    [Object.assign(new Error('Bad credentials'), { status: 401 }), 'authentication'],
    [Object.assign(new Error('rate limit'), { status: 429 }), 'rateLimit'],
    [new TypeError('Failed to fetch'), 'unavailable'],
    [new Error('unexpected'), 'unknown'],
  ] as const)('reports sync failures as %s', async (failure, error) => {
    github.get.mockRejectedValue(failure);

    await persistence.sync();

    expect(await persistence.getSyncStatus()).toMatchObject({ lastError: error, syncInProgress: false });
    expect(await fakeBrowser.storage.local.get(STORAGE_KEYS.lastSyncTime)).toEqual({});
  });

  it('shares one in-flight sync between overlapping triggers', async () => {
    const response = Promise.withResolvers<{ data: { files: Record<string, never> } }>();
    github.get.mockReturnValue(response.promise);
    github.update.mockResolvedValue({});

    const first = persistence.sync();
    const second = persistence.sync();
    expect(second).toBe(first);
    await vi.waitFor(() => expect(github.get).toHaveBeenCalledOnce());

    response.resolve({ data: { files: {} } });
    await first;
    expect(github.update).toHaveBeenCalledOnce();
  });
});
