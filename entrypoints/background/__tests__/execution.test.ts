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
import { STORAGE_KEYS } from '@/infrastructure/storage/storage-keys';
import * as cards from '@/services/cards';
import * as setup from '@/services/gist-setup';
import * as sync from '@/services/github-sync';
import * as notes from '@/services/notes';
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
  it('edits a card note by slug while preserving the card and its schedule', async () => {
    const card = await cards.addCard(problem);
    await expect(dispatch('getNote', { slug: problem.slug })).resolves.toBeNull();
    await dispatch('saveNote', { slug: problem.slug, text: '  Remember the complement  ' });
    expect(await dispatch('getAllCards')).toEqual([{ ...card, note: '  Remember the complement  ' }]);
    expect(await dispatch('getNote', { slug: problem.slug })).toEqual({ text: '  Remember the complement  ' });
    await dispatch('saveNote', { slug: problem.slug, text: '' });
    expect(await dispatch('getAllCards')).toEqual([card]);
    expect(await dispatch('getNote', { slug: problem.slug })).toBeNull();
  });

  it('rejects a missing-card save, allows absent reads/deletes, and never looks up UUIDs', async () => {
    const card = await cards.addCard(problem);
    const tracking = vi.spyOn(tracker, 'markDataUpdated');
    const writes = vi.spyOn(browser.storage.local, 'set');
    await expect(dispatch('saveNote', { slug: card.id, text: 'No owner' })).rejects.toThrow('not found');
    expect(tracking).not.toHaveBeenCalled();
    expect(writes).not.toHaveBeenCalled();
    expect(await dispatch('getNote', { slug: card.id })).toBeNull();
    await expect(dispatch('deleteNote', { slug: card.id })).resolves.toBeUndefined();
    expect(await dispatch('getAllCards')).toEqual([card]);
  });

  it('keeps serialized note and card edits together, then removes notes with cards and on reset', async () => {
    await dispatch('addCard', { problem });
    await Promise.all([
      dispatch('saveNote', { slug: problem.slug, text: 'Keep me' }),
      dispatch('setPauseStatus', { slug: problem.slug, paused: true }),
    ]);
    expect(await dispatch('getAllCards')).toMatchObject([{ slug: problem.slug, paused: true, note: 'Keep me' }]);
    await dispatch('removeCard', { slug: problem.slug });
    expect(await dispatch('getNote', { slug: problem.slug })).toBeNull();
    await dispatch('addCard', { problem });
    expect(await dispatch('getNote', { slug: problem.slug })).toBeNull();
    await dispatch('saveNote', { slug: problem.slug, text: 'Reset me' });
    await dispatch('resetAllData');
    expect(await dispatch('getNote', { slug: problem.slug })).toBeNull();
    expect(await dispatch('getAllCards')).toEqual([]);
  });

  it.each(['length', 'write'] as const)('preserves the note and timestamp after a %s failure', async (failure) => {
    await dispatch('addCard', { problem });
    await dispatch('saveNote', { slug: problem.slug, text: 'a'.repeat(500) });
    const previous = await dispatch('getAllCards');
    const timestamp = await storage.getItem(STORAGE_KEYS.dataUpdatedAt);
    if (failure === 'write') vi.spyOn(browser.storage.local, 'set').mockRejectedValueOnce(new Error('Unavailable'));
    await expect(
      dispatch('saveNote', {
        slug: problem.slug,
        text: failure === 'length' ? 'b'.repeat(501) : 'Changed',
      })
    ).rejects.toThrow();
    expect(await dispatch('getAllCards')).toEqual(previous);
    expect(await dispatch('getNote', { slug: problem.slug })).toEqual({ text: 'a'.repeat(500) });
    expect(await storage.getItem(STORAGE_KEYS.dataUpdatedAt)).toBe(timestamp);
  });

  it('blocks normal commands when the embedded-note startup migration rejects an ambiguous owner', async () => {
    fakeBrowser.reset();
    vi.mocked(onMessage).mockClear();
    const card = await cards.addCard(problem);
    await storage.setItem(STORAGE_KEYS.cards, {
      [problem.slug]: card,
      other: { ...card, slug: 'other' },
    });
    await storage.setItem(STORAGE_KEYS.schemaVersion, 3);
    await storage.setItem(`local:leetsrs:notes:${card.id}`, { text: 'Ambiguous' });
    const before = await fakeBrowser.storage.local.get(null);
    vi.spyOn(console, 'error').mockImplementation(() => {});
    background.main();
    await expect(dispatch('getAllCards')).rejects.toThrow('Duplicate card ID');
    await expect(dispatch('saveNote', { slug: problem.slug, text: 'New' })).rejects.toThrow('Duplicate card ID');
    await expect(dispatch('removeCard', { slug: problem.slug })).rejects.toThrow('Duplicate card ID');
    expect(await fakeBrowser.storage.local.get(null)).toEqual(before);
  });

  it('registers every message synchronously', () => {
    expect(
      vi
        .mocked(onMessage)
        .mock.calls.map(([name]) => name)
        .sort()
    ).toEqual(Object.keys(messagePayloadSchemas).sort());
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
    const second = dispatch('deleteNote', { slug: 'card' });
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
      await notes.saveNote(card.slug, 'existing note');
      const tracking = vi.spyOn(tracker, 'markDataUpdated');
      const badge = vi.spyOn(browser.action, 'setBadgeText');

      await dispatch(name, { slug: card.slug, text: 'remember' });

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
  expect(await dispatch('getNote', { slug: 'card' })).toEqual({ text: 'after failure' });
});
