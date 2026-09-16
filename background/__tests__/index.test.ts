import { registerService } from '@webext-core/proxy-service';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { browser } from 'wxt/browser';
import { fakeBrowser } from 'wxt/testing/fake-browser';
import { storage } from 'wxt/utils/storage';

import { LEARNING_DOCUMENT_VERSION } from '@/shared/models';
import { readLearningDocument } from '@/shared/storage';
import { getRegisteredBackground } from '@/test/utils/background-service';
import { buildProblem } from '@/test/utils/card-mocks';
import { buildLearningDocument } from '@/test/utils/learning-document-mocks';
import backgroundEntry from '../../entrypoints/background/index';

vi.mock('@webext-core/proxy-service', () => import('@/test/mocks/proxy-service'));

vi.mock('octokit', () => ({
  Octokit: vi.fn(() => {
    throw new Error('Network unavailable');
  }),
}));

function startBackground() {
  vi.mocked(registerService).mockClear();
  const registration = vi.spyOn(browser.alarms.onAlarm, 'addListener');
  backgroundEntry.main();
  const listener = registration.mock.calls.at(-1)?.[0];
  if (!listener) throw new Error('Alarm listener was not registered synchronously');
  return (name = 'gist-sync') =>
    listener({ name, scheduledTime: Date.now(), periodInMinutes: 1, persistAcrossSessions: true });
}

beforeEach(() => {
  fakeBrowser.reset();
  fakeBrowser.runtime.id = 'test';
});
afterEach(() => vi.useRealTimers());

it('refreshes the badge when an Again card becomes due without another save or sync tick', async () => {
  await browser.storage.local.set({
    'leetsrs:learningDocument': { ...buildLearningDocument(), settings: { badgeEnabled: false } },
  });
  const fireAlarm = startBackground();
  await getRegisteredBackground().waitForInitialization();
  vi.useFakeTimers();
  await getRegisteredBackground().addCard(buildProblem());
  await vi.advanceTimersByTimeAsync(0);
  const badge = vi.spyOn(browser.action, 'setBadgeText');
  await getRegisteredBackground().rateCard({ ...buildProblem(), rating: 1 });
  const card = (await readLearningDocument()).cards['1'];
  await vi.advanceTimersByTimeAsync(0);
  expect(badge).toHaveBeenLastCalledWith({ text: '' });
  expect(await browser.alarms.get('badge-refresh')).toMatchObject({ scheduledTime: card.fsrs.due });
  const create = vi.spyOn(browser.alarms, 'create');
  await fireAlarm();
  expect(create).not.toHaveBeenCalled();
  const writes = vi.spyOn(browser.storage.local, 'set');
  vi.setSystemTime(card.fsrs.due);
  await fireAlarm('badge-refresh');
  expect(badge).toHaveBeenLastCalledWith({ text: '1' });
  expect(writes).not.toHaveBeenCalled();
  expect(await browser.alarms.get('badge-refresh')).toBeUndefined();
  await getRegisteredBackground().rateCard({ ...buildProblem(), rating: 1 });
  await vi.advanceTimersByTimeAsync(0);
  expect(await browser.alarms.get('badge-refresh')).toBeDefined();
  await getRegisteredBackground().removeCard('1');
  await vi.advanceTimersByTimeAsync(0);
  expect(await browser.alarms.get('badge-refresh')).toBeUndefined();
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
      const read = getRegisteredBackground().waitForInitialization();
      const write = getRegisteredBackground().addCard(buildProblem());
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
        expect(readResult).toEqual({ status: 'fulfilled', value: undefined });
        expect(writeResult).toEqual({ status: 'fulfilled', value: undefined });
        expect(Object.values((await readLearningDocument()).cards)).toMatchObject([buildProblem()]);
      } else {
        expect(readResult).toEqual({ status: 'rejected', reason: failure });
        expect(writeResult).toEqual({ status: 'rejected', reason: failure });
        await expect(getRegisteredBackground().waitForInitialization()).rejects.toBe(failure);
        await expect(getRegisteredBackground().removeCard('1')).rejects.toBe(failure);
        expect(report).toHaveBeenCalledExactlyOnceWith('Failed to initialize background:', failure);
        expect(badge).not.toHaveBeenCalled();
        startBackground();
        await getRegisteredBackground().waitForInitialization();
        expect(Object.values((await readLearningDocument()).cards)).toEqual([]);
      }
    }
  );

  it.each([
    { schemaVersion: LEARNING_DOCUMENT_VERSION, cards: {}, stats: {} },
    { schemaVersion: LEARNING_DOCUMENT_VERSION + 1, cards: {}, stats: {}, settings: {} },
    { schemaVersion: LEARNING_DOCUMENT_VERSION, cards: 'corrupt', stats: {}, settings: {} },
  ])('rejects a saved invalid document without falling back to legacy data: %j', async (document) => {
    await fakeBrowser.storage.local.set({
      'leetsrs:learningDocument': document,
      'leetsrs:cards': {},
      'leetsrs:schemaVersion': 5,
    });
    const before = await fakeBrowser.storage.local.get(null);
    const writes = vi.spyOn(fakeBrowser.storage.local, 'set');
    const snapshots = vi.spyOn(storage, 'snapshot').mockRejectedValue(new Error('Must not gather legacy storage'));
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const fireAlarm = startBackground();
    await expect(getRegisteredBackground().waitForInitialization()).rejects.toThrow();
    await expect(getRegisteredBackground().addCard(buildProblem())).rejects.toThrow();
    await fireAlarm();
    expect(writes).not.toHaveBeenCalled();
    expect(snapshots).not.toHaveBeenCalled();
    expect(await fakeBrowser.storage.local.get(null)).toEqual(before);
    expect(await fakeBrowser.storage.sync.get()).toEqual({});
  });

  it.each([false, true])('preserves the one-minute alarm (already exists: %s)', async (exists) => {
    if (exists) await browser.alarms.create('gist-sync', { periodInMinutes: 1 });
    const create = vi.spyOn(browser.alarms, 'create');
    const fireAlarm = startBackground();
    await getRegisteredBackground().waitForInitialization();
    expect(create.mock.calls).toEqual(exists ? [] : [['gist-sync', { periodInMinutes: 1 }]]);
    await new Promise((resolve) => setTimeout(resolve, 0));
    const badge = vi.spyOn(browser.action, 'setBadgeText');
    await fireAlarm();
    expect(badge).toHaveBeenCalledExactlyOnceWith({ text: '' });
    badge.mockClear();
    await fireAlarm('unrelated');
    expect(badge).not.toHaveBeenCalled();
  });
});

it('starts OAuth from a permission-grant event without another popup command', async () => {
  vi.stubEnv('WXT_GITHUB_CLIENT_ID', 'client');
  const redirect = 'https://aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa.chromiumapp.org/';
  vi.spyOn(browser.identity, 'getRedirectURL').mockReturnValue(redirect);
  const oauth = vi.spyOn(browser.identity, 'launchWebAuthFlow').mockImplementation(() => new Promise(() => {}));
  const contains = vi.spyOn(browser.permissions, 'contains').mockImplementation(async () => false);
  startBackground();
  const service = getRegisteredBackground();
  await service.startGithubSignIn();
  expect(oauth).not.toHaveBeenCalled();
  contains.mockImplementation(async () => true);
  const onGrant = vi.mocked(browser.permissions.onAdded.addListener).mock.calls.at(-1)?.[0];
  if (!onGrant) throw new Error('Permission listener was not registered');
  onGrant({ origins: ['https://api.github.com/*'] });
  await vi.waitFor(() => expect(oauth).toHaveBeenCalledOnce());
  await service.signOutGithub();
});
