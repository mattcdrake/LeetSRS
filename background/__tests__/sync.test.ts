import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fakeBrowser } from 'wxt/testing/fake-browser';
import { resetAllData, updateSettings } from '@/background/learning';
import { lastSyncTimeItem, readGistConnection, writeGistConnection } from '@/shared/gist-sync';
import {
  LEARNING_DOCUMENT_VERSION,
  type LearningDocument,
  readLearningDocument,
  replaceLearningDocument,
} from '@/shared/learning-document';
import { createMockCard } from '@/test/utils/card-mocks';
import { seedGithubAuthorization } from '@/test/utils/github-auth';
import { buildLearningDocument } from '@/test/utils/learning-document-mocks';
import * as syncModule from '../sync';

const github = vi.hoisted(() => ({ get: vi.fn(), update: vi.fn(), create: vi.fn(), list: vi.fn() }));

vi.mock('@/background/github-gists', () => ({ gistsApi: () => github }));

describe('whole-document Gist sync', () => {
  const now = '2026-09-13T12:00:00.000Z';
  const connection = { accountId: 1, gistId: 'gist', enabled: true };
  const local: LearningDocument = {
    schemaVersion: LEARNING_DOCUMENT_VERSION,
    cards: {},
    reviewActivity: null,
    settings: { theme: 'dark' },
    activeRoadmapId: 'blind-75',
    roadmapSkips: { 'blind-75': ['1'] },
    dataUpdatedAt: '2026-09-12T12:00:00.000Z',
  };

  beforeEach(async () => {
    fakeBrowser.reset();
    vi.resetAllMocks();
    vi.useFakeTimers();
    vi.setSystemTime(new Date(now));
    await resetAllData();
    await seedGithubAuthorization();
    await writeGistConnection(connection);
    await replaceLearningDocument(local);
  });

  afterEach(() => vi.useRealTimers());

  it('downloads existing history on first connection after changing a fresh browser setting', async () => {
    await resetAllData();
    await seedGithubAuthorization();
    await updateSettings({ resetEditorOnReviewQueue: false });
    expect((await readLearningDocument()).dataUpdatedAt).toBe(now);
    const remote = buildLearningDocument({
      cards: { '1': createMockCard(2) },
      reviewActivity: { date: '2026-09-12', newCards: 1, streak: 5 },
      dataUpdatedAt: '2026-09-12T12:00:00.000Z',
    });
    github.get.mockResolvedValue({
      owner: { id: 1 },
      files: { 'leetsrs-backup.json': { content: JSON.stringify(remote) } },
    });

    expect(await syncModule.setupGistSync({ mode: 'existing', gistId: 'gist' })).toEqual({ saved: true });
    await syncModule.sync();

    expect(github.update).not.toHaveBeenCalled();
    expect(await readLearningDocument()).toEqual(remote);
    expect(await readGistConnection()).toEqual(connection);

    await updateSettings({ theme: 'light' });
    await syncModule.sync();
    const uploaded = JSON.parse(github.update.mock.calls[0][1]['leetsrs-backup.json'].content);
    expect(uploaded.cards).toEqual(remote.cards);
    expect(uploaded.reviewActivity).toEqual(remote.reviewActivity);
  });

  it('paginates owned backups and only suggests an owned previous destination', async () => {
    await fakeBrowser.storage.local.set({ 'leetsrs:oauthMigration': { notice: true, previousGist: 'previous' } });
    github.list.mockResolvedValueOnce(
      Array.from({ length: 100 }, (_, index) => ({ id: `other-${index}`, owner: { id: 1 }, files: {} }))
    );
    github.list.mockResolvedValueOnce([
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
    ]);
    expect(await syncModule.listGistDestinations()).toEqual([
      { id: 'owned', description: 'My backup', updatedAt: now, suggested: false },
    ]);
    expect(github.list.mock.calls).toEqual([[1], [2]]);
  });

  it.each(['invalid', 'truncated', 'not-owned'])(
    'validates an existing %s backup before changing the connection',
    async (kind) => {
      github.get.mockResolvedValue({
        owner: { id: kind === 'not-owned' ? 2 : 1 },
        files: {
          'leetsrs-backup.json': {
            content: kind === 'not-owned' ? JSON.stringify(local) : 'invalid json',
            truncated: kind === 'truncated',
            raw_url: 'https://gist.githubusercontent.com/test/backup/raw/file',
          },
        },
      });
      const download = vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(JSON.stringify(local)));
      const result = await syncModule.setupGistSync({ mode: 'existing', gistId: 'selected' });
      expect(result.saved).toBe(kind === 'truncated');
      if (kind === 'truncated') {
        expect(download).toHaveBeenCalledWith(
          'https://gist.githubusercontent.com/test/backup/raw/file',
          expect.objectContaining({ credentials: 'omit' })
        );
        await syncModule.sync();
      } else {
        if (kind === 'not-owned') expect(result).toEqual({ saved: false, error: 'authentication' });
        expect(await readGistConnection()).toEqual(connection);
      }
    }
  );

  it('does not reconnect if sign-out happens during destination validation', async () => {
    const response = Promise.withResolvers<{ owner: { id: number }; files: Record<string, { content: string }> }>();
    github.get.mockReturnValueOnce(response.promise);
    const pending = syncModule.setupGistSync({ mode: 'existing', gistId: 'selected' });
    await vi.waitFor(() => expect(github.get).toHaveBeenCalledOnce());
    await syncModule.signOutGithub();
    response.resolve({ owner: { id: 1 }, files: { 'leetsrs-backup.json': { content: JSON.stringify(local) } } });
    expect((await pending).saved).toBe(false);
    expect(await readGistConnection()).toEqual({ accountId: null, gistId: null, enabled: false });
    expect(await readLearningDocument()).toEqual(local);
  });

  it.each([
    { localTime: '2026-09-12T12:00:00.000Z', remoteTime: '2026-09-11T12:00:00.000Z', direction: 'push' },
    { localTime: '2026-09-12T12:00:00.000Z', remoteTime: '2026-09-14T12:00:00.000Z', direction: 'pull' },
    { localTime: undefined, remoteTime: undefined, direction: 'push' },
    { localTime: '2026-09-12T12:00:00.000Z', remoteTime: undefined, direction: 'push' },
    { localTime: undefined, remoteTime: '2026-09-12T12:00:00.000Z', direction: 'pull' },
    { localTime: '2026-09-12T12:00:00.000Z', remoteTime: '2026-09-12T12:00:00.000Z', direction: null },
    { localTime: '2026-09-12T12:00:00.000Z', remoteTime: '2026-09-12T04:00:00-08:00', direction: null },
  ])(
    'handles local $localTime and remote $remoteTime with direction $direction',
    async ({ localTime, remoteTime, direction }) => {
      const document = { ...local, dataUpdatedAt: localTime };
      const remote = {
        ...local,
        settings: { theme: 'light' as const },
        activeRoadmapId: 'grind-75' as const,
        roadmapSkips: { 'grind-75': ['2'] },
        dataUpdatedAt: remoteTime,
      };
      await replaceLearningDocument(document);
      github.get.mockResolvedValue({
        owner: { id: 1 },
        files: { 'leetsrs-backup.json': { content: JSON.stringify(remote) } },
      });

      await syncModule.sync();

      if (direction === 'push') {
        expect(github.update).toHaveBeenCalledExactlyOnceWith('gist', {
          'leetsrs-backup.json': { content: expect.any(String) },
        });
        expect(JSON.parse(github.update.mock.calls[0][1]['leetsrs-backup.json'].content)).toEqual(document);
      } else {
        expect(github.update).not.toHaveBeenCalled();
      }
      expect(await readLearningDocument()).toEqual(direction === 'pull' ? remote : document);
      expect(await syncModule.getGistSyncStatus()).toEqual({
        lastSyncTime: now,
        syncInProgress: false,
        lastError: null,
      });
    }
  );

  it.each([{ schemaVersion: 999 }, { dataUpdatedAt: 'invalid' }])(
    'rejects an invalid remote document %j before overwriting either side',
    async (invalid) => {
      github.get.mockResolvedValue({
        owner: { id: 1 },
        files: { 'leetsrs-backup.json': { content: JSON.stringify({ ...local, ...invalid }) } },
      });
      const writes = vi.spyOn(fakeBrowser.storage.local, 'set');

      await syncModule.sync();

      expect(writes).not.toHaveBeenCalled();
      expect(github.update).not.toHaveBeenCalled();
      expect(await readLearningDocument()).toEqual(local);
      expect(await syncModule.getGistSyncStatus()).toMatchObject({ lastError: 'unknown', syncInProgress: false });
    }
  );

  it.each([
    [Object.assign(new Error('Bad credentials'), { status: 401 }), 'authentication'],
    [Object.assign(new Error('rate limit'), { status: 429 }), 'rateLimit'],
    [new TypeError('Failed to fetch'), 'unavailable'],
    [new Error('unexpected'), 'unknown'],
  ] as const)('reports sync failures as %s', async (failure, error) => {
    const lastSyncTime = '2026-09-11T12:00:00.000Z';
    await lastSyncTimeItem.setValue(lastSyncTime);
    github.get.mockRejectedValue(failure);

    await syncModule.sync();

    expect(await syncModule.getGistSyncStatus()).toMatchObject({ lastError: error, syncInProgress: false });
    expect(await lastSyncTimeItem.getValue()).toBe(lastSyncTime);
  });
});
