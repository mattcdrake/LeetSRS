import { registerService } from '@webext-core/proxy-service';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { browser } from 'wxt/browser';
import { fakeBrowser } from 'wxt/testing/fake-browser';
import { ZodError } from 'zod';
import type { BackgroundService } from '@/shared/background-service';
import { readGistConnection, readLearningDocument } from '@/shared/storage';
import { getRegisteredBackground } from '@/test/utils/background-service';
import { buildProblem } from '@/test/utils/card-mocks';
import { buildLearningDocument } from '@/test/utils/learning-document-mocks';
import backgroundEntry from '../../entrypoints/background/index';

vi.mock('@webext-core/proxy-service');

beforeEach(async () => {
  fakeBrowser.reset();
  fakeBrowser.runtime.id = 'test';
  vi.mocked(registerService).mockClear();
  backgroundEntry.main();
  await getRegisteredBackground().waitForInitialization();
  await new Promise((resolve) => setTimeout(resolve, 0));
});

const problem = buildProblem();

describe('registered background execution', () => {
  it('resets learning data, connection and status, then ignores stale learning data on restart', async () => {
    await getRegisteredBackground().rateCard({ ...problem, rating: 3 });
    await getRegisteredBackground().saveNote(problem.frontendId, 'Reset me');
    await getRegisteredBackground().updateSettings({ language: 'zh-CN' });
    await fakeBrowser.storage.sync.set({ 'leetsrs:gistConnection': { accountId: 1, gistId: 'gist', enabled: true } });
    const staleLocal = {
      'leetsrs:cards': { stale: 'invalid leftover' },
      'leetsrs:stats': { stale: 'invalid leftover' },
      'leetsrs:schemaVersion': 3,
      'leetsrs:dataUpdatedAt': '2024-01-01T00:00:00.000Z',
      'leetsrs:notes:old-id': { text: 'stale note' },
    };
    await fakeBrowser.storage.local.set({
      ...staleLocal,
      'leetsrs:lastSyncTime': 'old',
      'leetsrs:lastSyncDirection': 'pull',
      unrelated: 'keep',
    });
    await fakeBrowser.storage.sync.set({
      'leetsrs:githubPat': 'legacy secret',
      'leetsrs:gistId': 'old-gist',
      'leetsrs:gistSyncEnabled': true,
      'leetsrs:theme': 'dark',
      'leetsrs:dayStartHour': 4,
      'leetsrs:autoClearLeetcode': true,
      unrelated: 'keep',
    });

    await getRegisteredBackground().resetAllData();

    const empty = buildLearningDocument();
    const rpc = vi.spyOn(browser.runtime, 'sendMessage');
    expect(await readLearningDocument()).toEqual(empty);
    expect(await readGistConnection()).toEqual({ accountId: null, gistId: null, enabled: false });
    expect(rpc).not.toHaveBeenCalled();
    expect(await getRegisteredBackground().getGistSyncStatus()).toEqual({
      lastSyncTime: null,
      lastSyncDirection: null,
      syncInProgress: false,
      lastError: null,
    });
    expect(await fakeBrowser.storage.local.get(null)).toEqual({
      'leetsrs:learningDocument': empty,
      'leetsrs:oauthMigration': { notice: false, previousGist: null },
      unrelated: 'keep',
    });
    expect(await fakeBrowser.storage.sync.get(null)).toEqual({ unrelated: 'keep' });

    await fakeBrowser.storage.local.set(staleLocal);
    vi.mocked(registerService).mockClear();
    backgroundEntry.main();
    expect(Object.values((await readLearningDocument()).cards)).toEqual([]);
    expect((await readLearningDocument()).cards[problem.frontendId]?.note ?? null).toBeNull();
    expect((await readLearningDocument()).reviewActivity).toBeNull();
    expect(await readLearningDocument()).toEqual(empty);
  });
  it.each(['document', 'connection cleanup'] as const)(
    'reports reset failure at %s without resurrecting data on restart',
    async (stage) => {
      await getRegisteredBackground().addCard(problem);
      await fakeBrowser.storage.sync.set({
        'leetsrs:gistConnection': { accountId: 1, gistId: 'gist', enabled: true },
      });
      const before = JSON.stringify(await readLearningDocument(), null, 2);
      const failure = new Error('Reset storage unavailable');
      if (stage === 'document') {
        vi.spyOn(fakeBrowser.storage.local, 'set').mockRejectedValueOnce(failure);
      } else {
        vi.spyOn(fakeBrowser.storage.sync, 'remove').mockRejectedValueOnce(failure);
      }
      await expect(getRegisteredBackground().resetAllData()).rejects.toBe(failure);
      expect(await readGistConnection()).toEqual({ accountId: null, gistId: null, enabled: false });
      vi.mocked(registerService).mockClear();
      backgroundEntry.main();
      if (stage === 'document') {
        expect(JSON.stringify(await readLearningDocument(), null, 2)).toBe(before);
      } else {
        expect(Object.values((await readLearningDocument()).cards)).toEqual([]);
      }
      await getRegisteredBackground().resetAllData();
      expect(Object.values((await readLearningDocument()).cards)).toEqual([]);
      expect(await readGistConnection()).toEqual({ accountId: null, gistId: null, enabled: false });
    }
  );

  it.each(['setBadgeText', 'setBadgeBackgroundColor'] as const)(
    'keeps a saved card successful when %s fails and accepts the next write',
    async (method) => {
      const failure = new Error('Badge unavailable');
      vi.spyOn(browser.action, method).mockRejectedValueOnce(failure);
      const report = vi.spyOn(console, 'warn').mockImplementation(() => {});
      await expect(getRegisteredBackground().addCard(problem)).resolves.toBeUndefined();
      expect(Object.values((await readLearningDocument()).cards)).toMatchObject([problem]);
      expect(report).toHaveBeenCalledWith('Failed to refresh badge:', failure);
      await getRegisteredBackground().saveNote(problem.frontendId, 'saved after badge failure');
      expect((await readLearningDocument()).cards[problem.frontendId]?.note ?? null).toBe('saved after badge failure');
    }
  );

  it('responds to saves while badge work is pending', async () => {
    const started = Promise.withResolvers<void>();
    const release = Promise.withResolvers<void>();
    vi.spyOn(browser.action, 'setBadgeText').mockImplementationOnce(async () => {
      started.resolve();
      await release.promise;
    });
    await getRegisteredBackground().addCard(problem);
    await started.promise;
    await getRegisteredBackground().saveNote(problem.frontendId, 'next edit');
    expect((await readLearningDocument()).cards[problem.frontendId]?.note).toBe('next edit');
    release.resolve();
  });
});

const invalidArguments: [keyof BackgroundService, unknown[]][] = [
  ['getProblem', ['', 'leetcode.com']],
  ['getProblem', ['two-sum', 'invalid']],
  ['addCard', [{ ...problem, frontendId: '' }]],
  ['removeCard', ['']],
  ['delayCard', [problem.frontendId, 0.5]],
  ['setPauseStatus', [problem.frontendId, 'false']],
  ['rateCard', [{ ...problem, rating: 0 }]],
  ['saveNote', ['card', 'a'.repeat(501)]],
  ['saveNote', ['card']],
  ['saveNote', ['card', 'note', 'extra']],
  ['updateSettings', [{ language: 'constructor' }]],
  ['importData', [{}]],
  ['setupGistSync', [{ mode: 'existing', gistId: 42, pat: 'token' }]],
  ['setupGistSync', [{ mode: 'invalid' }]],
  ['setupGistSync', [{ mode: 'existing', gistId: '' }]],
  ['setGistSyncEnabled', ['true']],
  ['waitForInitialization', ['extra']],
  ['resetAllData', ['extra']],
  ['getGistSyncStatus', ['extra']],
];

it.each(invalidArguments)(
  'rejects invalid %s input before mutation and accepts a later valid edit',
  async (name, invalid) => {
    const writes = vi.spyOn(browser.storage.local, 'set');
    const badge = vi.spyOn(browser.action, 'setBadgeText');
    await expect(Reflect.apply(getRegisteredBackground()[name], undefined, invalid)).rejects.toBeInstanceOf(ZodError);
    expect(writes).not.toHaveBeenCalled();
    expect(badge).not.toHaveBeenCalled();
    await getRegisteredBackground().addCard(buildProblem({ frontendId: 'card' }));
    await getRegisteredBackground().saveNote('card', 'after failure');
    expect((await readLearningDocument()).cards.card?.note ?? null).toBe('after failure');
  }
);
