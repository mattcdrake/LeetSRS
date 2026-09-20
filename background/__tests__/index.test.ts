import { registerService } from '@webext-core/proxy-service';
import { State } from 'ts-fsrs';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { browser } from 'wxt/browser';
import { fakeBrowser } from 'wxt/testing/fake-browser';
import { storage } from 'wxt/utils/storage';

import { BADGE_ALARM_NAME, refreshBadge } from '@/background/badge';
import { LEARNING_DOCUMENT_VERSION } from '@/shared/models';
import { readLearningDocument, STORAGE_KEYS } from '@/shared/storage';
import { getRegisteredBackground } from '@/test/utils/background-service';
import { buildProblem, createMockCard } from '@/test/utils/card-mocks';
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

it('refreshes the badge at midnight before an Again card’s timestamp without another save or sync tick', async () => {
  await browser.storage.local.set({
    'leetsrs:learningDocument': { ...buildLearningDocument(), settings: { badgeEnabled: false } },
  });
  const fireAlarm = startBackground();
  await getRegisteredBackground().waitForInitialization();
  vi.useFakeTimers();
  vi.setSystemTime(new Date('2024-03-15T10:00:00'));
  await getRegisteredBackground().addCard(buildProblem());
  await vi.advanceTimersByTimeAsync(0);
  const badge = vi.spyOn(browser.action, 'setBadgeText');
  await getRegisteredBackground().rateCard({ ...buildProblem(), rating: 1 });
  const card = (await readLearningDocument()).cards['1'];
  await vi.advanceTimersByTimeAsync(0);
  expect(badge).toHaveBeenLastCalledWith({ text: '' });
  expect(await browser.alarms.get('badge-refresh')).toMatchObject({
    scheduledTime: new Date('2024-03-16T00:00:00').getTime(),
  });
  const create = vi.spyOn(browser.alarms, 'create');
  await fireAlarm();
  expect(create).not.toHaveBeenCalled();
  const writes = vi.spyOn(browser.storage.local, 'set');
  vi.setSystemTime(new Date('2024-03-16T00:00:00'));
  expect(card.fsrs.due).toBeGreaterThan(Date.now());
  await fireAlarm('badge-refresh');
  expect(badge).toHaveBeenLastCalledWith({ text: '1' });
  expect(writes).not.toHaveBeenCalled();
  expect(await browser.alarms.get('badge-refresh')).toMatchObject({
    scheduledTime: new Date('2024-03-17T00:00:00').getTime(),
  });
  await getRegisteredBackground().rateCard({ ...buildProblem(), rating: 1 });
  await vi.advanceTimersByTimeAsync(0);
  expect(await browser.alarms.get('badge-refresh')).toBeDefined();
  await getRegisteredBackground().removeCard('1');
  await vi.advanceTimersByTimeAsync(0);
  expect(await browser.alarms.get('badge-refresh')).toBeUndefined();
});

it.each([
  ['2024-03-10', '2024-03-11', '2024-03-12'],
  ['2024-11-03', '2024-11-04', '2024-11-05'],
])(
  'refreshes the badge at local midnight and restores the new-card allowance on %s',
  async (today, tomorrow, nextDay) => {
    fakeBrowser.reset();
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date(`${today}T00:00:00`));
    const card = createMockCard(State.New);
    const document = buildLearningDocument({
      cards: { '1': card },
      settings: { maxNewCardsPerDay: 1 },
      reviewActivity: { date: today, newCards: 1, streak: 1 },
    });
    await storage.setItem(STORAGE_KEYS.learningDocument, document);
    try {
      await refreshBadge();
      expect(await fakeBrowser.action.getBadgeText({})).toBe('');
      expect(await fakeBrowser.alarms.get(BADGE_ALARM_NAME)).toMatchObject({
        scheduledTime: new Date(`${tomorrow}T00:00:00`).getTime(),
      });

      vi.setSystemTime(new Date(`${tomorrow}T00:00:00`));
      await refreshBadge();
      expect(await fakeBrowser.action.getBadgeText({})).toBe('1');
      expect(await fakeBrowser.alarms.get(BADGE_ALARM_NAME)).toMatchObject({
        scheduledTime: new Date(`${nextDay}T00:00:00`).getTime(),
      });

      card.paused = true;
      await storage.setItem(STORAGE_KEYS.learningDocument, document);
      await refreshBadge();
      expect(await fakeBrowser.action.getBadgeText({})).toBe('');
      expect(await fakeBrowser.alarms.get(BADGE_ALARM_NAME)).toBeUndefined();
    } finally {
      vi.useRealTimers();
    }
  }
);

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
    { ...buildLearningDocument(), settings: undefined },
    { ...buildLearningDocument(), schemaVersion: LEARNING_DOCUMENT_VERSION + 1 },
    { ...buildLearningDocument(), cards: 'corrupt' },
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
    expect(fetch).not.toHaveBeenCalled();
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
