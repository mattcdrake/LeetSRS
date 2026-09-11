import { Octokit } from 'octokit';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { browser } from 'wxt/browser';
import { fakeBrowser } from 'wxt/testing/fake-browser';
import { storage } from 'wxt/utils/storage';
import { messagePayloadSchemas, onMessage } from '@/infrastructure/browser/messages';
import * as tracker from '@/infrastructure/storage/data-tracker';
import * as connection from '@/infrastructure/storage/gist-connection';
import { runStartupMigrations } from '@/infrastructure/storage/migrations/runner';
import * as cards from '@/services/cards';
import * as setup from '@/services/gist-setup';
import { triggerGistSync } from '@/services/github-sync';
import * as notes from '@/services/notes';
import { getSettings } from '@/services/settings';
import { buildSettings } from '@/test/utils/settings-mocks';
import background from '../index';

vi.mock('octokit', () => ({ Octokit: vi.fn() }));
vi.mock('@/infrastructure/browser/messages', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/infrastructure/browser/messages')>()),
  onMessage: vi.fn(),
}));
vi.mock('@/infrastructure/storage/migrations/runner', () => ({ runStartupMigrations: vi.fn() }));
vi.mock('@/services/github-sync', () => ({ getGistSyncStatus: vi.fn(), triggerGistSync: vi.fn() }));
vi.mock('@/services/settings', () => ({ getSettings: vi.fn(), updateSettings: vi.fn() }));

function startBackground() {
  const registration = vi.spyOn(browser.alarms.onAlarm, 'addListener');
  background.main();
  const listener = registration.mock.calls[0]?.[0];
  if (!listener) throw new Error('Alarm listener was not registered synchronously');
  return (name = 'gist-sync') => listener({ name, scheduledTime: 0, persistAcrossSessions: true });
}

describe('background sync alarm', () => {
  beforeEach(async () => {
    fakeBrowser.reset();
    fakeBrowser.runtime.id = 'test';
    vi.mocked(runStartupMigrations).mockResolvedValue(undefined);
    vi.mocked(getSettings).mockResolvedValue(buildSettings());
    vi.spyOn(cards, 'getReviewQueue').mockResolvedValue([]);
    vi.mocked(triggerGistSync).mockResolvedValue({ success: true, action: 'no-change', timestamp: 'now' });
    await setup.setGistSyncConfig({ pat: 'token', gistId: 'gist', enabled: true });
  });

  it.each([
    { name: 'ready', enabled: true, pat: 'token', gistId: 'gist', syncs: true },
    { name: 'disabled', enabled: false, pat: 'token', gistId: 'gist', syncs: false },
    { name: 'missing credential', enabled: true, pat: null, gistId: 'gist', syncs: false },
    { name: 'empty credential', enabled: true, pat: '', gistId: 'gist', syncs: false },
    { name: 'missing destination', enabled: true, pat: 'token', gistId: null, syncs: false },
    { name: 'empty destination', enabled: true, pat: 'token', gistId: '', syncs: false },
  ])(
    'handles $name configuration without network requests during readiness',
    async ({ enabled, pat, gistId, syncs }) => {
      await setup.setGistSyncConfig({ enabled, pat: pat ?? '', gistId });
      const destination = vi.spyOn(connection, 'readGistConnection');
      const badge = vi.spyOn(browser.action, 'setBadgeText');
      const fireAlarm = startBackground();

      await fireAlarm();

      expect(destination).toHaveBeenCalledOnce();
      expect(triggerGistSync).toHaveBeenCalledTimes(syncs ? 1 : 0);
      expect(Octokit).not.toHaveBeenCalled();
      // Startup refresh plus either the sync runner's refresh or the skipped-alarm fallback.
      expect(badge.mock.calls).toEqual([[{ text: '' }], [{ text: '' }]]);
    }
  );

  it('registers synchronously but waits for startup before checking readiness', async () => {
    const migrations = Promise.withResolvers<void>();
    vi.mocked(runStartupMigrations).mockReturnValue(migrations.promise);
    const destination = vi.spyOn(connection, 'readGistConnection');
    const fireAlarm = startBackground();
    const pending = fireAlarm();
    await Promise.resolve();
    expect(destination).not.toHaveBeenCalled();
    expect(triggerGistSync).not.toHaveBeenCalled();

    migrations.resolve();
    await pending;
    expect(triggerGistSync).toHaveBeenCalledOnce();
  });

  it.each(['pending', 'failed'] as const)(
    'blocks RPCs and sync alarms when migration fails (submitted while %s)',
    async (startupState) => {
      const migrations = Promise.withResolvers<void>();
      const failure = new Error('migration failed');
      vi.mocked(runStartupMigrations).mockReturnValue(migrations.promise);
      const report = vi.spyOn(console, 'error').mockImplementation(() => {});
      const readHandler = vi.spyOn(cards, 'getAllCards').mockResolvedValue([]);
      const writeHandler = vi.spyOn(cards, 'removeCard').mockResolvedValue(undefined);
      const tracking = vi.spyOn(tracker, 'markDataUpdated');
      const writes = vi.spyOn(storage, 'setItem');
      const destination = vi.spyOn(connection, 'readGistConnection');
      const alarmRead = vi.spyOn(browser.alarms, 'get');
      const alarmCreate = vi.spyOn(browser.alarms, 'create');
      const badgeText = vi.spyOn(browser.action, 'setBadgeText');
      const badgeColor = vi.spyOn(browser.action, 'setBadgeBackgroundColor');
      const fireAlarm = startBackground();
      const readListener = vi.mocked(onMessage).mock.calls.find(([name]) => name === 'getAllCards')?.[1];
      const writeListener = vi.mocked(onMessage).mock.calls.find(([name]) => name === 'removeCard')?.[1];
      if (!readListener || !writeListener) throw new Error('RPC listeners were not registered synchronously');

      if (startupState === 'failed') {
        migrations.reject(failure);
        await vi.waitFor(() => expect(report).toHaveBeenCalled());
      }
      const results = Promise.allSettled([
        readListener({ id: 1, type: 'getAllCards', data: undefined, timestamp: 0, sender: {} }),
        writeListener({ id: 2, type: 'removeCard', data: { slug: 'two-sum' }, timestamp: 0, sender: {} }),
        fireAlarm(),
      ]);
      if (startupState === 'pending') migrations.reject(failure);
      const [read, write, alarm] = await results;

      expect.soft(read).toEqual({ status: 'rejected', reason: failure });
      expect.soft(write).toEqual({ status: 'rejected', reason: failure });
      expect.soft(alarm).toEqual({ status: 'fulfilled', value: undefined });
      expect.soft(readHandler).not.toHaveBeenCalled();
      expect.soft(writeHandler).not.toHaveBeenCalled();
      expect.soft(triggerGistSync).not.toHaveBeenCalled();
      expect.soft(Octokit).not.toHaveBeenCalled();
      expect.soft(tracking).not.toHaveBeenCalled();
      expect.soft(writes).not.toHaveBeenCalled();
      expect.soft(destination).not.toHaveBeenCalled();
      expect.soft(alarmRead).not.toHaveBeenCalled();
      expect.soft(alarmCreate).not.toHaveBeenCalled();
      expect.soft(getSettings).not.toHaveBeenCalled();
      expect.soft(cards.getReviewQueue).not.toHaveBeenCalled();
      expect.soft(badgeText).not.toHaveBeenCalled();
      expect.soft(badgeColor).not.toHaveBeenCalled();
      expect(report).toHaveBeenCalledExactlyOnceWith('Failed to initialize background:', failure);
    }
  );

  it('keeps alarm sync behind writes submitted through messaging', async () => {
    const writeStarted = Promise.withResolvers<void>();
    const releaseWrite = Promise.withResolvers<void>();
    const checked = Promise.withResolvers<void>();
    vi.spyOn(notes, 'deleteNote').mockImplementation(async () => {
      writeStarted.resolve();
      await releaseWrite.promise;
    });
    const readConfig = connection.readGistConnection;
    vi.spyOn(connection, 'readGistConnection').mockImplementation(async () => {
      const ready = await readConfig();
      checked.resolve();
      return ready;
    });
    const fireAlarm = startBackground();
    const listener = vi.mocked(onMessage).mock.calls.find(([name]) => name === 'deleteNote')?.[1];
    if (!listener) throw new Error('deleteNote listener was not registered');
    const writing = listener({ id: 1, type: 'deleteNote', data: { slug: 'card' }, timestamp: 0, sender: {} });
    await writeStarted.promise;
    const syncing = fireAlarm();
    await checked.promise;
    expect(triggerGistSync).not.toHaveBeenCalled();

    releaseWrite.resolve();
    await Promise.all([writing, syncing]);
    expect(triggerGistSync).toHaveBeenCalledOnce();
  });

  it('validates direct alarm execution and recovers its shared queue after rejection', async () => {
    const fireAlarm = startBackground();
    const failure = new Error('invalid alarm payload');
    const parse = vi.spyOn(messagePayloadSchemas.triggerGistSync, 'parse').mockImplementationOnce(() => {
      throw failure;
    });
    await expect(fireAlarm()).rejects.toBe(failure);
    expect(parse).toHaveBeenCalledExactlyOnceWith(undefined);
    expect(triggerGistSync).not.toHaveBeenCalled();
    await fireAlarm();
    expect(triggerGistSync).toHaveBeenCalledOnce();
  });

  it('holds reads and writes until startup succeeds', async () => {
    const migrations = Promise.withResolvers<void>();
    vi.mocked(runStartupMigrations).mockReturnValue(migrations.promise);
    startBackground();
    const listeners = vi.mocked(onMessage).mock.calls;
    const read = listeners.find(([name]) => name === 'getAllCards')?.[1];
    const write = listeners.find(([name]) => name === 'deleteNote')?.[1];
    if (!read || !write) throw new Error('Missing synchronous listeners');
    const deleteNote = vi.spyOn(notes, 'deleteNote').mockResolvedValue(undefined);
    let readCompleted = false;
    const reading = Promise.resolve(
      read({ id: 1, type: 'getAllCards', data: undefined, timestamp: 0, sender: {} })
    ).then((result) => {
      readCompleted = true;
      return result;
    });
    const writing = write({ id: 2, type: 'deleteNote', data: { slug: 'card' }, timestamp: 0, sender: {} });
    await Promise.resolve();
    expect(readCompleted).toBe(false);
    expect(deleteNote).not.toHaveBeenCalled();
    migrations.resolve();
    await expect(reading).resolves.toEqual([]);
    await writing;
    expect(deleteNote).toHaveBeenCalledOnce();
  });

  it.each([false, true])('preserves the one-minute alarm (already exists: %s)', async (exists) => {
    if (exists) await browser.alarms.create('gist-sync', { periodInMinutes: 1 });
    const create = vi.spyOn(browser.alarms, 'create');
    await startBackground()();
    expect(create.mock.calls).toEqual(exists ? [] : [['gist-sync', { periodInMinutes: 1 }]]);
  });

  it('ignores unrelated alarms', async () => {
    const fireAlarm = startBackground();
    await fireAlarm();
    vi.clearAllMocks();

    await fireAlarm('unrelated');
    expect(triggerGistSync).not.toHaveBeenCalled();
  });
});
