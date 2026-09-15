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
import { seedGithubAuthorization } from '@/test/utils/github-auth';
import * as persistence from '../persistence';

const github = vi.hoisted(() => ({ get: vi.fn(), update: vi.fn(), create: vi.fn(), list: vi.fn() }));

vi.mock('octokit', () => ({
  Octokit: vi.fn(function MockOctokit() {
    return { rest: { gists: github } };
  }),
}));

describe('whole-document Gist sync', () => {
  const now = '2026-09-13T12:00:00.000Z';
  const connection = { accountId: 1, gistId: 'gist', enabled: true };
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
    await seedGithubAuthorization();
    await writeGistConnection(connection);
    await replaceLearningDocument(local);
  });

  afterEach(() => vi.useRealTimers());

  it('saves an existing Gist connection and starts syncing without watching connection changes', async () => {
    github.get.mockResolvedValue({
      data: { owner: { id: 1 }, files: { 'leetsrs-backup.json': { content: JSON.stringify(local) } } },
    });

    expect(await persistence.connectGist({ mode: 'existing', gistId: 'new-gist' })).toEqual({
      saved: true,
    });

    await vi.waitFor(() => expect(github.get).toHaveBeenCalledTimes(2));
    await vi.waitFor(async () => expect(await persistence.getSyncStatus()).toMatchObject({ syncInProgress: false }));
    expect(Octokit).toHaveBeenCalledWith({ auth: 'new-token' });
    expect(github.get).toHaveBeenCalledWith({ gist_id: 'new-gist' });
    expect(await readGistConnection()).toEqual({ accountId: 1, gistId: 'new-gist', enabled: true });
    expect(await readLearningDocument()).toEqual(local);
    expect(await persistence.getSyncStatus()).toMatchObject({
      lastSyncTime: expect.any(String),
      syncInProgress: false,
    });
  });

  it('creates a private Gist with syncing enabled', async () => {
    github.create.mockResolvedValue({ data: { id: 'created-gist' } });
    github.get.mockResolvedValue({ data: { owner: { id: 1 }, files: {} } });

    expect(await persistence.connectGist({ mode: 'create' })).toEqual({ saved: true });

    expect(github.create).toHaveBeenCalledExactlyOnceWith({
      description: 'LeetSRS Backup - Spaced Repetition Data',
      public: false,
      files: { 'leetsrs-backup.json': { content: expect.any(String) } },
    });
    expect(JSON.parse(github.create.mock.calls[0][0].files['leetsrs-backup.json'].content)).toEqual(local);
    expect(await readGistConnection()).toEqual({ accountId: 1, gistId: 'created-gist', enabled: true });
    await vi.waitFor(() => expect(github.get).toHaveBeenCalledExactlyOnceWith({ gist_id: 'created-gist' }));
    await vi.waitFor(async () => expect(await persistence.getSyncStatus()).toMatchObject({ syncInProgress: false }));
  });

  it.each([
    ['missing backup', { mode: 'existing', gistId: 'gist' } as const, 'missingBackup'],
    ['missing created ID', { mode: 'create' } as const, 'creationFailed'],
  ])('keeps the previous connection when setup fails with %s', async (_name, setup, error) => {
    github.get.mockResolvedValue({ data: { owner: { id: 1 }, files: {} } });
    github.create.mockResolvedValue({ data: {} });

    expect(await persistence.connectGist(setup)).toEqual({ saved: false, error });
    expect(await readGistConnection()).toEqual(connection);
  });

  it('paginates owned backups and only suggests an owned previous destination', async () => {
    await fakeBrowser.storage.local.set({ 'leetsrs:oauthMigration': { notice: true, previousGist: 'previous' } });
    github.list.mockResolvedValueOnce({
      data: Array.from({ length: 100 }, (_, index) => ({ id: `other-${index}`, owner: { id: 1 }, files: {} })),
    });
    github.list.mockResolvedValueOnce({
      data: [
        {
          id: 'previous',
          owner: { id: 2 },
          description: 'Someone else',
          updated_at: now,
          files: { 'leetsrs-backup.json': {} },
        },
        {
          id: 'owned',
          owner: { id: 1 },
          description: 'My backup',
          updated_at: now,
          files: { 'leetsrs-backup.json': {} },
        },
      ],
    });
    expect(await persistence.listGistDestinations()).toEqual([
      { id: 'owned', description: 'My backup', updatedAt: now, suggested: false },
    ]);
    expect(github.list.mock.calls.map(([request]) => request)).toEqual([
      { per_page: 100, page: 1 },
      { per_page: 100, page: 2 },
    ]);
  });

  it.each(['invalid', 'truncated', 'not-owned'])(
    'validates an existing %s backup before changing the connection',
    async (kind) => {
      github.get.mockResolvedValue({
        data: {
          owner: { id: kind === 'not-owned' ? 2 : 1 },
          files: {
            'leetsrs-backup.json': {
              content: 'invalid json',
              truncated: kind === 'truncated',
              raw_url: 'https://gist.githubusercontent.com/test/backup/raw/file',
            },
          },
        },
      });
      const download = vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(JSON.stringify(local)));
      const result = await persistence.connectGist({ mode: 'existing', gistId: 'selected' });
      expect(result.saved).toBe(kind === 'truncated');
      if (kind === 'truncated') {
        expect(download).toHaveBeenCalledWith(
          'https://gist.githubusercontent.com/test/backup/raw/file',
          expect.objectContaining({ credentials: 'omit' })
        );
        await persistence.sync();
      } else expect(await readGistConnection()).toEqual(connection);
    }
  );

  it('does not reconnect if sign-out happens during destination validation', async () => {
    const response = Promise.withResolvers<{
      data: { owner: { id: number }; files: Record<string, { content: string }> };
    }>();
    github.get.mockReturnValueOnce(response.promise);
    const pending = persistence.connectGist({ mode: 'existing', gistId: 'selected' });
    await vi.waitFor(() => expect(github.get).toHaveBeenCalledOnce());
    await persistence.disconnectGithub();
    response.resolve({
      data: { owner: { id: 1 }, files: { 'leetsrs-backup.json': { content: JSON.stringify(local) } } },
    });
    expect((await pending).saved).toBe(false);
    expect(await readGistConnection()).toEqual({ accountId: null, gistId: null, enabled: false });
    expect(await readLearningDocument()).toEqual(local);
  });

  it('sign-out removes a connection whose storage write is already in progress', async () => {
    github.get.mockResolvedValue({
      data: { owner: { id: 1 }, files: { 'leetsrs-backup.json': { content: JSON.stringify(local) } } },
    });
    const started = Promise.withResolvers<void>();
    const release = Promise.withResolvers<void>();
    const write = fakeBrowser.storage.local.set.bind(fakeBrowser.storage.local);
    vi.spyOn(fakeBrowser.storage.local, 'set').mockImplementationOnce(async (items) => {
      started.resolve();
      await release.promise;
      await write(items);
    });
    const connecting = persistence.connectGist({ mode: 'existing', gistId: 'selected' });
    await started.promise;
    const signingOut = persistence.disconnectGithub();
    release.resolve();
    await Promise.all([connecting, signingOut]);
    expect(await readGistConnection()).toEqual({ accountId: null, gistId: null, enabled: false });
    expect(await readLearningDocument()).toEqual(local);
  });

  it('uses stable error codes for GitHub and storage failures', async () => {
    github.get.mockRejectedValueOnce(Object.assign(new Error('Not Found'), { status: 404 }));
    expect(await persistence.connectGist({ mode: 'existing', gistId: 'missing' })).toEqual({
      saved: false,
      error: 'gistNotFound',
    });

    github.get.mockResolvedValue({
      data: { owner: { id: 1 }, files: { 'leetsrs-backup.json': { content: JSON.stringify(local) } } },
    });
    vi.spyOn(fakeBrowser.storage.local, 'set').mockRejectedValueOnce(new Error('disk failed'));
    expect(await persistence.connectGist({ mode: 'existing', gistId: 'gist' })).toEqual({
      saved: false,
      error: 'connectionSaveFailed',
    });
  });

  it.each([
    [{ accountId: null }, 'missingToken'],
    [{ gistId: null }, 'missingGist'],
  ] as const)('rejects enabling an incomplete connection', async (missing, error) => {
    await writeGistConnection({ ...connection, ...missing, enabled: false });

    expect(await persistence.setSyncEnabled(true)).toEqual({ saved: false, error });
    expect((await readGistConnection()).enabled).toBe(false);
    expect(github.get).not.toHaveBeenCalled();
  });

  it('enables sync without watching connection changes and stops it when disabled', async () => {
    await writeGistConnection({ ...connection, enabled: false });
    github.get.mockResolvedValue({ data: { owner: { id: 1 }, files: {} } });

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
      data: { owner: { id: 1 }, files: { 'leetsrs-backup.json': { content: JSON.stringify(remote) } } },
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
      data: { owner: { id: 1 }, files: { 'leetsrs-backup.json': { content: JSON.stringify(remote) } } },
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
        data: { owner: { id: 1 }, files: { 'leetsrs-backup.json': { content: JSON.stringify(remote) } } },
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
        data: {
          owner: { id: 1 },
          files: { 'leetsrs-backup.json': { content: JSON.stringify({ ...local, ...invalid }) } },
        },
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
    const response = Promise.withResolvers<{ data: { owner: { id: 1 }; files: Record<string, never> } }>();
    github.get.mockReturnValue(response.promise);
    github.update.mockResolvedValue({});

    const first = persistence.sync();
    const second = persistence.sync();
    expect(second).toBe(first);
    await vi.waitFor(() => expect(github.get).toHaveBeenCalledOnce());

    response.resolve({ data: { owner: { id: 1 }, files: {} } });
    await first;
    expect(github.update).toHaveBeenCalledOnce();
  });
});
