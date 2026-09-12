import { beforeEach, describe, expect, it, vi } from 'vitest';
import { browser } from 'wxt/browser';
import { fakeBrowser } from 'wxt/testing/fake-browser';
import { ZodError } from 'zod';
import { type MessageName, messagePayloadSchemas, onMessage } from '@/infrastructure/browser/messages';
import { dispatchBackgroundCommand as dispatch } from '@/test/utils/background-messages';
import { buildProblem } from '@/test/utils/card-mocks';
import background from '../index';

vi.mock('@/infrastructure/browser/messages', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/infrastructure/browser/messages')>()),
  onMessage: vi.fn(),
}));

beforeEach(async () => {
  fakeBrowser.reset();
  fakeBrowser.runtime.id = 'test';
  vi.mocked(onMessage).mockClear();
  background.main();
  await dispatch('getSettings');
});

const problem = buildProblem();

describe('registered background execution', () => {
  it('registers every message synchronously', () => {
    expect(
      vi
        .mocked(onMessage)
        .mock.calls.map(([name]) => name)
        .sort()
    ).toEqual(Object.keys(messagePayloadSchemas).sort());
  });

  it('resets learning data, connection and status, then ignores stale learning data on restart', async () => {
    await dispatch('rateCard', { input: { ...problem, rating: 3 } });
    await dispatch('saveNote', { slug: problem.slug, text: 'Reset me' });
    await dispatch('updateSettings', { changes: { language: 'de' } });
    await dispatch('setGistSyncConfig', { config: { pat: 'secret', gistId: 'gist', enabled: true } });
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

    await dispatch('resetAllData');

    const empty = { schemaVersion: 6, cards: {}, stats: {}, settings: {} };
    expect(JSON.parse(await dispatch('exportData'))).toEqual(empty);
    expect(await dispatch('getGistSyncConfig')).toEqual({ pat: '', gistId: null, enabled: false });
    expect(await dispatch('getGistSyncStatus')).toEqual({
      lastSyncTime: null,
      lastSyncDirection: null,
      syncInProgress: false,
      lastError: null,
    });
    expect(await fakeBrowser.storage.local.get(null)).toEqual({ 'leetsrs:learningDocument': empty, unrelated: 'keep' });
    expect(await fakeBrowser.storage.sync.get(null)).toEqual({ unrelated: 'keep' });

    await fakeBrowser.storage.local.set(staleLocal);
    vi.mocked(onMessage).mockClear();
    background.main();
    expect(await dispatch('getAllCards')).toEqual([]);
    expect(await dispatch('getNote', { slug: problem.slug })).toBeNull();
    expect(await dispatch('getTodayStats')).toBeNull();
    expect(JSON.parse(await dispatch('exportData'))).toEqual(empty);
  });
  it.each(['document', 'connection cleanup'] as const)(
    'reports reset failure at %s without resurrecting data on restart',
    async (stage) => {
      await dispatch('addCard', { problem });
      await dispatch('setGistSyncConfig', { config: { pat: 'secret', gistId: 'gist', enabled: true } });
      const before = await dispatch('exportData');
      const failure = new Error('Reset storage unavailable');
      if (stage === 'document') {
        vi.spyOn(fakeBrowser.storage.local, 'set').mockRejectedValueOnce(failure);
      } else {
        vi.spyOn(fakeBrowser.storage.sync, 'remove').mockRejectedValueOnce(failure);
      }
      await expect(dispatch('resetAllData')).rejects.toBe(failure);
      expect(await dispatch('getGistSyncConfig')).toEqual({ pat: 'secret', gistId: 'gist', enabled: true });
      vi.mocked(onMessage).mockClear();
      background.main();
      if (stage === 'document') {
        expect(await dispatch('exportData')).toBe(before);
      } else {
        expect(await dispatch('getAllCards')).toEqual([]);
      }
      await dispatch('resetAllData');
      expect(await dispatch('getAllCards')).toEqual([]);
      expect(await dispatch('getGistSyncConfig')).toEqual({ pat: '', gistId: null, enabled: false });
    }
  );

  it.each(['setBadgeText', 'setBadgeBackgroundColor'] as const)(
    'keeps a saved card successful when %s fails and accepts the next write',
    async (method) => {
      const failure = new Error('Badge unavailable');
      vi.spyOn(browser.action, method).mockRejectedValueOnce(failure);
      const report = vi.spyOn(console, 'warn').mockImplementation(() => {});
      await expect(dispatch('addCard', { problem })).resolves.toMatchObject(problem);
      expect(await dispatch('getAllCards')).toMatchObject([problem]);
      expect(report).toHaveBeenCalledWith('Failed to refresh badge:', failure);
      await dispatch('saveNote', { slug: problem.slug, text: 'saved after badge failure' });
      expect(await dispatch('getNote', { slug: problem.slug })).toBe('saved after badge failure');
    }
  );

  it('keeps badge effects inside the write queue while reads see the saved document', async () => {
    const started = Promise.withResolvers<void>();
    const release = Promise.withResolvers<void>();
    vi.spyOn(browser.action, 'setBadgeText').mockImplementationOnce(async () => {
      started.resolve();
      await release.promise;
    });
    const first = dispatch('addCard', { problem });
    const second = dispatch('saveNote', { slug: problem.slug, text: 'next edit' });
    await started.promise;
    expect(await dispatch('getAllCards')).toMatchObject([problem]);
    expect(await dispatch('getNote', { slug: problem.slug })).toBeNull();
    release.resolve();
    await Promise.all([first, second]);
    expect(await dispatch('getNote', { slug: problem.slug })).toBe('next edit');
  });

  it('serializes whole-connection updates and exposes the previous record while a write is pending', async () => {
    await dispatch('setGistSyncConfig', { config: { pat: 'old', gistId: 'old-gist', enabled: false } });
    const started = Promise.withResolvers<void>();
    const release = Promise.withResolvers<void>();
    const write = browser.storage.sync.set.bind(browser.storage.sync);
    const writes = vi.spyOn(browser.storage.sync, 'set').mockImplementationOnce(async (items) => {
      started.resolve();
      await release.promise;
      await write(items);
    });
    const changingPat = dispatch('setGistSyncConfig', { config: { pat: 'new' } });
    const changingGist = dispatch('setGistSyncConfig', { config: { gistId: 'new-gist' } });
    const enabling = dispatch('setGistSyncConfig', { config: { enabled: true } });
    await started.promise;
    expect(await dispatch('getGistSyncConfig')).toEqual({ pat: 'old', gistId: 'old-gist', enabled: false });
    expect(writes).toHaveBeenCalledOnce();
    release.resolve();
    await Promise.all([changingPat, changingGist, enabling]);
    expect(await dispatch('getGistSyncConfig')).toEqual({ pat: 'new', gistId: 'new-gist', enabled: true });
    expect(writes.mock.calls).toEqual([
      [{ 'leetsrs:gistConnection': { pat: 'new', gistId: 'old-gist', enabled: false } }],
      [{ 'leetsrs:gistConnection': { pat: 'new', gistId: 'new-gist', enabled: false } }],
      [{ 'leetsrs:gistConnection': { pat: 'new', gistId: 'new-gist', enabled: true } }],
    ]);
  });
});

const invalidPayloads: [MessageName, unknown][] = [
  ['addCard', { problem: { ...problem, difficulty: 'Impossible' } }],
  ['removeCard', { slug: '' }],
  ['delayCard', { slug: problem.slug, days: 0.5 }],
  ['setPauseStatus', { slug: problem.slug, paused: 'false' }],
  ['rateCard', { input: { ...problem, rating: 0 } }],
  ['getNote', { slug: '' }],
  ['saveNote', { slug: 'card', text: 'a'.repeat(501) }],
  ['deleteNote', { slug: 42 }],
  ['updateSettings', { changes: { language: 'constructor' } }],
  ['shouldResetEditor', { slug: problem.slug, domain: 'example.com' }],
  ['getLastNDaysStats', { days: -1 }],
  ['getNextNDaysStats', { days: '14' }],
  ['importData', { jsonData: {} }],
  ['setGistSyncConfig', { config: { gistId: 42 } }],
  ['validatePat', { pat: null }],
  ['validateGistId', { gistId: 'gist', pat: 42 }],
  ['triggerGistSync', {}],
];

it.each(invalidPayloads)('rejects invalid %s input before mutation and recovers the queue', async (name, invalid) => {
  const writes = vi.spyOn(browser.storage.local, 'set');
  const badge = vi.spyOn(browser.action, 'setBadgeText');
  await expect(dispatch(name, invalid)).rejects.toBeInstanceOf(ZodError);
  expect(writes).not.toHaveBeenCalled();
  expect(badge).not.toHaveBeenCalled();
  await dispatch('addCard', { problem: buildProblem({ slug: 'card' }) });
  await dispatch('saveNote', { slug: 'card', text: 'after failure', extra: true });
  expect(await dispatch('getNote', { slug: 'card' })).toBe('after failure');
});
