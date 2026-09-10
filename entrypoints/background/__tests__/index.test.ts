import { Octokit } from 'octokit';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { browser } from 'wxt/browser';
import { fakeBrowser } from 'wxt/testing/fake-browser';
import { storage } from 'wxt/utils/storage';
import { onMessage } from '@/infrastructure/browser/messages';
import * as tracker from '@/infrastructure/storage/data-tracker';
import { runStartupMigrations } from '@/infrastructure/storage/migrations';
import { STORAGE_KEYS } from '@/infrastructure/storage/storage-keys';
import * as cards from '@/services/cards';
import * as setup from '@/services/gist-setup';
import * as auth from '@/services/github-auth';
import { triggerGistSync } from '@/services/github-sync';
import { getSettings } from '@/services/settings';
import { buildSettings } from '@/test/utils/settings-mocks';
import background from '../index';
import { messages } from '../message-handlers';

vi.mock('octokit', () => ({ Octokit: vi.fn() }));
vi.mock('@/infrastructure/browser/messages', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/infrastructure/browser/messages')>()),
  onMessage: vi.fn(),
}));
vi.mock('@/infrastructure/storage/migrations', () => ({ runStartupMigrations: vi.fn() }));
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
    await storage.setItem(STORAGE_KEYS.githubPat, 'token');
    await storage.setItem(STORAGE_KEYS.gistId, 'gist');
    await storage.setItem(STORAGE_KEYS.gistSyncEnabled, true);
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
      await storage.setItem(STORAGE_KEYS.gistSyncEnabled, enabled);
      if (pat === null) await storage.removeItem(STORAGE_KEYS.githubPat);
      else await storage.setItem(STORAGE_KEYS.githubPat, pat);
      if (gistId === null) await storage.removeItem(STORAGE_KEYS.gistId);
      else await storage.setItem(STORAGE_KEYS.gistId, gistId);
      const credentials = vi.spyOn(auth, 'hasGitHubCredentials');
      const destination = vi.spyOn(setup, 'getGistDestinationConfig');
      const badge = vi.spyOn(browser.action, 'setBadgeText');
      const fireAlarm = startBackground();

      await fireAlarm();

      expect(credentials).toHaveBeenCalledOnce();
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
    const credentials = vi.spyOn(auth, 'hasGitHubCredentials');
    const destination = vi.spyOn(setup, 'getGistDestinationConfig');
    const fireAlarm = startBackground();
    const pending = fireAlarm();
    await Promise.resolve();
    expect(credentials).not.toHaveBeenCalled();
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
      const readHandler = vi.spyOn(messages.getAllCards, 'handler').mockResolvedValue([]);
      const writeHandler = vi.spyOn(messages.removeCard, 'handler').mockResolvedValue(undefined);
      const tracking = vi.spyOn(tracker, 'markDataUpdated');
      const writes = vi.spyOn(storage, 'setItem');
      const credentials = vi.spyOn(auth, 'hasGitHubCredentials');
      const destination = vi.spyOn(setup, 'getGistDestinationConfig');
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
      expect.soft(credentials).not.toHaveBeenCalled();
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
    vi.spyOn(messages.deleteNote, 'handler').mockImplementation(async () => {
      writeStarted.resolve();
      await releaseWrite.promise;
    });
    const hasCredentials = auth.hasGitHubCredentials;
    vi.spyOn(auth, 'hasGitHubCredentials').mockImplementation(async () => {
      const ready = await hasCredentials();
      checked.resolve();
      return ready;
    });
    const fireAlarm = startBackground();
    const listener = vi.mocked(onMessage).mock.calls.find(([name]) => name === 'deleteNote')?.[1];
    if (!listener) throw new Error('deleteNote listener was not registered');
    const writing = listener({ id: 1, type: 'deleteNote', data: { cardId: 'card' }, timestamp: 0, sender: {} });
    await writeStarted.promise;
    const syncing = fireAlarm();
    await checked.promise;
    expect(triggerGistSync).not.toHaveBeenCalled();

    releaseWrite.resolve();
    await Promise.all([writing, syncing]);
    expect(triggerGistSync).toHaveBeenCalledOnce();
  });

  it.each([false, true])('preserves the one-minute alarm (already exists: %s)', async (exists) => {
    if (exists) await browser.alarms.create('gist-sync', { periodInMinutes: 1 });
    const create = vi.spyOn(browser.alarms, 'create');
    await startBackground()();
    expect(create.mock.calls).toEqual(exists ? [] : [['gist-sync', { periodInMinutes: 1 }]]);
  });

  it('ignores unrelated alarms', async () => {
    const credentials = vi.spyOn(auth, 'hasGitHubCredentials');
    const fireAlarm = startBackground();
    await fireAlarm();
    vi.clearAllMocks();

    await fireAlarm('unrelated');
    expect(credentials).not.toHaveBeenCalled();
    expect(triggerGistSync).not.toHaveBeenCalled();
  });
});
