import { beforeEach, describe, expect, it, vi } from 'vitest';
import { browser } from 'wxt/browser';
import { fakeBrowser } from 'wxt/testing/fake-browser';
import { storage } from 'wxt/utils/storage';
import { ZodError } from 'zod';
import {
  type MessageData,
  type MessageName,
  messagePayloadSchemas,
  onMessage,
} from '@/infrastructure/browser/messages';
import * as tracker from '@/infrastructure/storage/data-tracker';
import * as notes from '@/infrastructure/storage/notes';
import { STORAGE_KEYS } from '@/infrastructure/storage/storage-keys';
import * as cards from '@/services/cards';
import * as setup from '@/services/gist-setup';
import * as sync from '@/services/github-sync';
import { buildProblem } from '@/test/utils/card-mocks';
import background from '../index';

vi.mock('@/infrastructure/browser/messages', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/infrastructure/browser/messages')>()),
  onMessage: vi.fn(),
}));

vi.mock('@/services/github-sync', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/services/github-sync')>()),
  triggerGistSync: vi.fn(),
}));
vi.mock('@/services/gist-setup', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/services/gist-setup')>()),
  createNewGist: vi.fn(),
}));

// Exercise untrusted input through the listeners registered by the real background.
function dispatch(name: MessageName, data?: unknown) {
  const listener = vi.mocked(onMessage).mock.calls.find(([registered]) => registered === name)?.[1];
  if (!listener) throw new Error(`Missing listener for ${name}`);
  return listener({ id: 1, type: name, data: data as MessageData<MessageName>, timestamp: 0, sender: {} });
}

beforeEach(async () => {
  fakeBrowser.reset();
  fakeBrowser.runtime.id = 'test';
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

  it('gates messages and alarms through interrupted recovery, then releases a fresh startup', async () => {
    const card = await cards.addCard(problem);
    await notes.saveNote(card.id, 'Keep this note');
    const backup = await dispatch('exportData');
    const {
      domain: _domain,
      fsrs: { last_review: _lastReview, ...schedule },
      ...fields
    } = card;
    const legacyCard = { ...fields, fsrs: schedule };
    await storage.setItem(STORAGE_KEYS.cards, { [card.slug]: legacyCard });
    await storage.removeItem(STORAGE_KEYS.schemaVersion);
    await storage.setItem(STORAGE_KEYS.githubPat, 'token');
    await storage.setItem(STORAGE_KEYS.gistId, 'gist');
    await storage.setItem(STORAGE_KEYS.gistSyncEnabled, true);
    vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.mocked(sync.triggerGistSync).mockResolvedValue({ success: true, action: 'no-change', timestamp: 'now' });

    const registration = vi.spyOn(browser.alarms.onAlarm, 'addListener');
    const start = () => {
      vi.mocked(onMessage).mockClear();
      registration.mockClear();
      background.main();
      const listener = registration.mock.calls[0]?.[0];
      if (!listener) throw new Error('Alarm listener was not registered synchronously');
      expect(onMessage).toHaveBeenCalledTimes(Object.keys(messagePayloadSchemas).length);
      return () => listener({ name: 'gist-sync', scheduledTime: 0, persistAcrossSessions: true });
    };
    const write = storage.setItem.bind(storage);
    const interrupted = vi.spyOn(storage, 'setItem').mockImplementation(async (key, value) => {
      if (key === STORAGE_KEYS.schemaVersion) throw new Error('completion interrupted');
      await write(key, value);
    });
    start();
    await expect(dispatch('getAllCards')).rejects.toThrow('migration 1 during complete');
    interrupted.mockRestore();
    const pending = await storage.getItem('local:leetsrs-migration:pending');
    expect(pending).toMatchObject({ version: 1, input: { cards: { [card.slug]: legacyCard } } });
    // Destroy the source to prove a new worker recovers from saved original input.
    await storage.setItem(STORAGE_KEYS.cards, { partial: true });

    const started = Promise.withResolvers<void>();
    const release = Promise.withResolvers<void>();
    const recovering = vi.spyOn(storage, 'setItem').mockImplementation(async (key, value) => {
      if (key === STORAGE_KEYS.cards) {
        started.resolve();
        await release.promise;
        throw new Error('recovery write failed');
      }
      await write(key, value);
    });
    const fireAlarm = start();
    await started.promise;
    const before = await fakeBrowser.storage.local.get(null);
    const syncBefore = await fakeBrowser.storage.sync.get(null);
    const submitMessages = () => [
      dispatch('getAllCards'),
      dispatch('rateCard', { input: { ...problem, rating: 3 } }),
      dispatch('importData', { jsonData: backup }),
      dispatch('triggerGistSync'),
    ];
    let settled = false;
    const blocked = Promise.allSettled([...submitMessages(), fireAlarm()]).then((results) => {
      settled = true;
      return results;
    });
    await Promise.resolve();
    expect(settled).toBe(false);
    expect(sync.triggerGistSync).not.toHaveBeenCalled();
    expect(await fakeBrowser.storage.local.get(null)).toEqual(before);
    release.resolve();
    const results = await blocked;
    for (const result of results.slice(0, 4)) {
      expect(result).toMatchObject({
        status: 'rejected',
        reason: expect.objectContaining({ message: expect.stringContaining('migration 1 during save') }),
      });
    }
    expect(results[4]).toEqual({ status: 'fulfilled', value: undefined });
    const afterFailure = await Promise.allSettled(submitMessages());
    expect(afterFailure.every((result) => result.status === 'rejected')).toBe(true);
    await fireAlarm();
    expect(sync.triggerGistSync).not.toHaveBeenCalled();
    expect(await fakeBrowser.storage.local.get(null)).toEqual(before);
    expect(await fakeBrowser.storage.sync.get(null)).toEqual(syncBefore);
    recovering.mockRestore();

    const recoveredAlarm = start();
    await expect(dispatch('getAllCards')).resolves.toEqual([card]);
    expect(await dispatch('getNote', { cardId: card.id })).toEqual({ text: 'Keep this note' });
    expect(await storage.getItem('local:leetsrs-migration:pending')).toBeNull();
    expect(await storage.getItem(STORAGE_KEYS.schemaVersion)).toBe(3);
    await dispatch('rateCard', { input: { ...problem, rating: 3 } });
    expect(await dispatch('getAllCards')).toMatchObject([{ fsrs: { reps: 1 } }]);
    await dispatch('importData', { jsonData: backup });
    await expect(dispatch('getAllCards')).resolves.toEqual([card]);
    // Import restores backup configuration, so re-enable alarm synchronization.
    await dispatch('setGistSyncConfig', { config: { enabled: true, gistId: 'gist' } });
    expect(JSON.parse((await dispatch('exportData')) as string).data).not.toHaveProperty('leetsrs-migration:pending');
    await dispatch('triggerGistSync');
    await recoveredAlarm();
    expect(sync.triggerGistSync).toHaveBeenCalledTimes(2);
  });

  it('lets reads overlap a write and keeps ordered effects inside the queue', async () => {
    const started = Promise.withResolvers<void>();
    const release = Promise.withResolvers<void>();
    const effectStarted = Promise.withResolvers<void>();
    const releaseEffect = Promise.withResolvers<void>();
    const events: string[] = [];
    vi.spyOn(cards, 'removeCard').mockImplementation(async () => {
      events.push('handler');
      started.resolve();
      await release.promise;
    });
    vi.spyOn(tracker, 'markDataUpdated').mockImplementationOnce(async () => {
      events.push('mark');
      effectStarted.resolve();
      await releaseEffect.promise;
    });
    vi.spyOn(browser.action, 'setBadgeText').mockImplementation(async () => {
      events.push('badge');
    });
    vi.spyOn(notes, 'deleteNote').mockImplementation(async () => {
      events.push('next');
    });

    const first = dispatch('removeCard', { slug: 'two-sum' });
    const second = dispatch('deleteNote', { cardId: 'card' });
    await started.promise;
    await expect(dispatch('getAllCards')).resolves.toEqual([]);
    expect(events).toEqual(['handler']);
    release.resolve();
    await effectStarted.promise;
    expect(events).toEqual(['handler', 'mark']);
    releaseEffect.resolve();
    await Promise.all([first, second]);
    expect(events).toEqual(['handler', 'mark', 'badge', 'next']);
  });

  it.each(['handler', 'tracking', 'badge'] as const)(
    'recovers after %s rejection without running later effects',
    async (stage) => {
      const failure = new Error(`${stage} failed`);
      const handler = vi.spyOn(cards, 'removeCard').mockResolvedValue(undefined);
      const tracking = vi.spyOn(tracker, 'markDataUpdated').mockResolvedValue(undefined);
      const badge = vi.spyOn(browser.action, 'setBadgeText').mockResolvedValue(undefined);
      if (stage === 'handler') handler.mockRejectedValueOnce(failure);
      if (stage === 'tracking') tracking.mockRejectedValueOnce(failure);
      if (stage === 'badge') badge.mockRejectedValueOnce(failure);

      await expect(dispatch('removeCard', { slug: 'two-sum' })).rejects.toBe(failure);
      expect(tracking).toHaveBeenCalledTimes(stage === 'handler' ? 0 : 1);
      expect(badge).toHaveBeenCalledTimes(stage === 'badge' ? 1 : 0);
      await expect(dispatch('removeCard', { slug: 'two-sum' })).resolves.toBeUndefined();
      expect(handler).toHaveBeenCalledTimes(2);
    }
  );

  it.each([true, false])('queues sync network work until the previous sync settles (success: %s)', async (success) => {
    const started = Promise.withResolvers<void>();
    const release = Promise.withResolvers<void>();
    const firstResult = success
      ? { success: true as const, action: 'no-change' as const, timestamp: 'now' }
      : { success: false as const, error: 'Gist not found' };
    const handler = vi
      .mocked(sync.triggerGistSync)
      .mockImplementationOnce(async () => {
        started.resolve();
        await release.promise;
        return firstResult;
      })
      .mockResolvedValueOnce({ success: true, action: 'pushed', timestamp: 'later' });
    const tracking = vi.spyOn(tracker, 'markDataUpdated');
    const badge = vi.spyOn(browser.action, 'setBadgeText');
    const first = dispatch('triggerGistSync');
    const second = dispatch('triggerGistSync');
    await started.promise;
    expect(handler).toHaveBeenCalledOnce();
    release.resolve();
    expect(await first).toEqual(firstResult);
    expect(await second).toEqual({ success: true, action: 'pushed', timestamp: 'later' });
    expect(tracking).not.toHaveBeenCalled();
    expect(badge).toHaveBeenCalledTimes(2);
  });

  it('preserves Gist creation results and errors without executor effects', async () => {
    const failure = new Error('save failed');
    vi.mocked(setup.createNewGist).mockResolvedValueOnce({ gistId: 'created' }).mockRejectedValueOnce(failure);
    const tracking = vi.spyOn(tracker, 'markDataUpdated');
    const badge = vi.spyOn(browser.action, 'setBadgeText');
    await expect(dispatch('createNewGist')).resolves.toEqual({ gistId: 'created' });
    await expect(dispatch('createNewGist')).rejects.toBe(failure);
    expect(tracking).not.toHaveBeenCalled();
    expect(badge).not.toHaveBeenCalled();
  });

  it('updates the timestamp and displays the queue size after adding a card', async () => {
    const tracking = vi.spyOn(tracker, 'markDataUpdated');
    const badge = vi.spyOn(browser.action, 'setBadgeText');

    const card = await dispatch('addCard', { problem });

    expect(card).toMatchObject(problem);
    expect(tracking).toHaveBeenCalledOnce();
    expect(badge).toHaveBeenCalledExactlyOnceWith({ text: '1' });
  });

  it.each([
    ['delayCard', { slug: problem.slug, days: 1 }],
    ['setPauseStatus', { slug: problem.slug, paused: true }],
    ['rateCard', { input: { ...problem, rating: 4 } }],
    ['removeCard', { slug: problem.slug }],
  ] as const)('%s updates the timestamp and refreshes the badge', async (name, data) => {
    await cards.addCard(problem);
    const tracking = vi.spyOn(tracker, 'markDataUpdated');
    const badge = vi.spyOn(browser.action, 'setBadgeText');

    await dispatch(name, data);

    expect(tracking).toHaveBeenCalledOnce();
    expect(badge).toHaveBeenCalledOnce();
  });

  it.each(['saveNote', 'deleteNote'] as const)(
    '%s updates the timestamp without refreshing the badge',
    async (name) => {
      const card = await cards.addCard(problem);
      await notes.saveNote(card.id, 'existing note');
      const tracking = vi.spyOn(tracker, 'markDataUpdated');
      const badge = vi.spyOn(browser.action, 'setBadgeText');

      await dispatch(name, { cardId: card.id, text: 'remember' });

      expect(tracking).toHaveBeenCalledOnce();
      expect(badge).not.toHaveBeenCalled();
    }
  );

  it('lets settings own timestamp updates and clears the badge when disabled', async () => {
    await cards.addCard(problem);
    const tracking = vi.spyOn(tracker, 'markDataUpdated');
    const badge = vi.spyOn(browser.action, 'setBadgeText');

    await dispatch('updateSettings', { changes: { badgeEnabled: false } });

    expect(tracking).toHaveBeenCalledOnce();
    expect(badge).toHaveBeenCalledExactlyOnceWith({ text: '' });
  });

  it('preserves the imported timestamp and refreshes the badge', async () => {
    await cards.addCard(problem);
    const timestamp = '2024-01-15T10:00:00.000Z';
    const backup = JSON.parse((await dispatch('exportData')) as string);
    backup.dataUpdatedAt = timestamp;
    const badge = vi.spyOn(browser.action, 'setBadgeText');

    await dispatch('importData', { jsonData: JSON.stringify(backup) });

    expect(await storage.getItem(STORAGE_KEYS.dataUpdatedAt)).toBe(timestamp);
    expect(badge).toHaveBeenCalledExactlyOnceWith({ text: '1' });
  });

  it('preserves the timestamp and badge when updating Gist configuration', async () => {
    const timestamp = '2024-01-15T10:00:00.000Z';
    await storage.setItem(STORAGE_KEYS.dataUpdatedAt, timestamp);
    const tracking = vi.spyOn(tracker, 'markDataUpdated');
    const badge = vi.spyOn(browser.action, 'setBadgeText');

    await dispatch('setGistSyncConfig', { config: { enabled: false } });

    expect(tracking).not.toHaveBeenCalled();
    expect(badge).not.toHaveBeenCalled();
    expect(await storage.getItem(STORAGE_KEYS.dataUpdatedAt)).toBe(timestamp);
  });

  it('removes cards and their timestamp and clears the badge on reset', async () => {
    await cards.addCard(problem);
    await storage.setItem(STORAGE_KEYS.dataUpdatedAt, '2024-01-15T10:00:00.000Z');
    const tracking = vi.spyOn(tracker, 'markDataUpdated');
    const badge = vi.spyOn(browser.action, 'setBadgeText');

    await dispatch('resetAllData');

    expect(await dispatch('getAllCards')).toEqual([]);
    expect(await storage.getItem(STORAGE_KEYS.dataUpdatedAt)).toBeNull();
    expect(tracking).not.toHaveBeenCalled();
    expect(badge).toHaveBeenCalledExactlyOnceWith({ text: '' });
  });
});

const invalidPayloads: [MessageName, unknown][] = [
  ['addCard', { problem: { ...problem, difficulty: 'Impossible' } }],
  ['removeCard', { slug: '' }],
  ['delayCard', { slug: problem.slug, days: 0.5 }],
  ['setPauseStatus', { slug: problem.slug, paused: 'false' }],
  ['rateCard', { input: { ...problem, rating: 0 } }],
  ['getNote', { cardId: '' }],
  ['saveNote', { cardId: 'card', text: 'a'.repeat(501) }],
  ['deleteNote', { cardId: 42 }],
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
  await dispatch('saveNote', { cardId: 'card', text: 'after failure', extra: true });
  expect(await dispatch('getNote', { cardId: 'card' })).toEqual({ text: 'after failure' });
});
