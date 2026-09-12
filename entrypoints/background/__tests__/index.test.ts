import { beforeEach, describe, expect, it, vi } from 'vitest';
import { browser } from 'wxt/browser';
import { fakeBrowser } from 'wxt/testing/fake-browser';
import { onMessage } from '@/infrastructure/browser/messages';
import { dispatchBackgroundCommand as dispatch } from '@/test/utils/background-messages';
import { buildProblem } from '@/test/utils/card-mocks';
import background from '../index';

vi.mock('@/infrastructure/browser/messages', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/infrastructure/browser/messages')>()),
  onMessage: vi.fn(),
}));

function startBackground() {
  vi.mocked(onMessage).mockClear();
  const registration = vi.spyOn(browser.alarms.onAlarm, 'addListener');
  background.main();
  const listener = registration.mock.calls.at(-1)?.[0];
  if (!listener) throw new Error('Alarm listener was not registered synchronously');
  return (name = 'gist-sync') =>
    listener({ name, scheduledTime: Date.now(), periodInMinutes: 1, persistAcrossSessions: true });
}

beforeEach(() => {
  fakeBrowser.reset();
  fakeBrowser.runtime.id = 'test';
});

describe('document startup through registered background commands', () => {
  it.each(['success', 'failure'] as const)(
    'registers synchronously and holds reads, writes and alarms until startup %s',
    async (outcome) => {
      const started = Promise.withResolvers<void>();
      const release = Promise.withResolvers<void>();
      const failure = new Error('Document write failed');
      const set = fakeBrowser.storage.local.set.bind(fakeBrowser.storage.local);
      vi.spyOn(fakeBrowser.storage.local, 'set').mockImplementationOnce(async (items) => {
        started.resolve();
        await release.promise;
        if (outcome === 'failure') throw failure;
        await set(items);
      });
      const report = vi.spyOn(console, 'error').mockImplementation(() => {});
      const badge = vi.spyOn(browser.action, 'setBadgeText');
      const fireAlarm = startBackground();
      const read = dispatch('getAllCards');
      const write = dispatch('addCard', { problem: buildProblem() });
      const alarm = fireAlarm();
      const settled = vi.fn();
      const results = Promise.allSettled([read, write, alarm]).then((result) => {
        settled();
        return result;
      });
      await started.promise;
      expect(settled).not.toHaveBeenCalled();
      expect(badge).not.toHaveBeenCalled();
      release.resolve();
      const [readResult, writeResult, alarmResult] = await results;
      expect(alarmResult).toEqual({ status: 'fulfilled', value: undefined });
      if (outcome === 'success') {
        expect(readResult).toEqual({ status: 'fulfilled', value: [] });
        expect(writeResult).toMatchObject({ status: 'fulfilled', value: buildProblem() });
        expect(await dispatch('getAllCards')).toMatchObject([buildProblem()]);
      } else {
        expect(readResult).toEqual({ status: 'rejected', reason: failure });
        expect(writeResult).toEqual({ status: 'rejected', reason: failure });
        await expect(dispatch('getSettings')).rejects.toBe(failure);
        await expect(dispatch('removeCard', { slug: 'two-sum' })).rejects.toBe(failure);
        expect(report).toHaveBeenCalledExactlyOnceWith('Failed to initialize background:', failure);
        expect(badge).not.toHaveBeenCalled();
        startBackground();
        expect(await dispatch('getAllCards')).toEqual([]);
      }
    }
  );

  it.each(['write', 'cleanup', 'connection'] as const)(
    'preserves a legacy installation across a startup %s failure and retry',
    async (stage) => {
      const legacy = {
        'leetsrs:schemaVersion': 5,
        'leetsrs:cards': {},
        'leetsrs:stats': {},
        'leetsrs:dataUpdatedAt': '2024-01-01T00:00:00.000Z',
      };
      await fakeBrowser.storage.local.set(legacy);
      await fakeBrowser.storage.sync.set({
        'leetsrs:language': 'de',
        'leetsrs:githubPat': 'secret',
        'leetsrs:gistId': 'gist',
        'leetsrs:gistSyncEnabled': true,
      });
      const failure = new Error('Storage unavailable');
      if (stage === 'write') vi.spyOn(fakeBrowser.storage.local, 'set').mockRejectedValueOnce(failure);
      if (stage === 'cleanup') vi.spyOn(fakeBrowser.storage.local, 'remove').mockRejectedValueOnce(failure);
      if (stage === 'connection') vi.spyOn(fakeBrowser.storage.sync, 'set').mockRejectedValueOnce(failure);
      vi.spyOn(console, 'error').mockImplementation(() => {});
      vi.spyOn(console, 'warn').mockImplementation(() => {});
      startBackground();
      if (stage === 'cleanup') {
        await dispatch('updateSettings', { changes: { language: 'pl' } });
      } else {
        await expect(dispatch('getSettings')).rejects.toBe(failure);
        expect(await fakeBrowser.storage.local.get(null)).toEqual(legacy);
      }
      startBackground();
      expect(await dispatch('getSettings')).toMatchObject({ language: stage === 'cleanup' ? 'pl' : 'de' });
      expect(await dispatch('getGistSyncConfig')).toEqual({ pat: 'secret', gistId: 'gist', enabled: true });
      if (stage !== 'cleanup') {
        expect(JSON.parse(await dispatch('exportData'))).toEqual({
          schemaVersion: 6,
          cards: {},
          stats: {},
          settings: { language: 'de' },
          dataUpdatedAt: legacy['leetsrs:dataUpdatedAt'],
        });
      }
    }
  );

  it.each([
    { schemaVersion: 7, cards: {}, stats: {}, settings: {} },
    { schemaVersion: 6, cards: 'corrupt', stats: {}, settings: {} },
  ])('rejects a saved invalid document without falling back to legacy data: %j', async (document) => {
    await fakeBrowser.storage.local.set({
      'leetsrs:learningDocument': document,
      'leetsrs:cards': {},
      'leetsrs:schemaVersion': 5,
    });
    const before = await fakeBrowser.storage.local.get(null);
    const writes = vi.spyOn(fakeBrowser.storage.local, 'set');
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const fireAlarm = startBackground();
    await expect(dispatch('getAllCards')).rejects.toThrow();
    await expect(dispatch('addCard', { problem: buildProblem() })).rejects.toThrow();
    await fireAlarm();
    expect(writes).not.toHaveBeenCalled();
    expect(await fakeBrowser.storage.local.get(null)).toEqual(before);
  });

  it.each([false, true])('preserves the one-minute alarm (already exists: %s)', async (exists) => {
    if (exists) await browser.alarms.create('gist-sync', { periodInMinutes: 1 });
    const create = vi.spyOn(browser.alarms, 'create');
    const fireAlarm = startBackground();
    await dispatch('getSettings');
    expect(create.mock.calls).toEqual(exists ? [] : [['gist-sync', { periodInMinutes: 1 }]]);
    const badge = vi.spyOn(browser.action, 'setBadgeText');
    await fireAlarm();
    expect(badge).toHaveBeenCalledExactlyOnceWith({ text: '' });
    badge.mockClear();
    await fireAlarm('unrelated');
    expect(badge).not.toHaveBeenCalled();
  });
});
