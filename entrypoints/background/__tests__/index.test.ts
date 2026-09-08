import { Octokit } from 'octokit';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { browser } from 'wxt/browser';
import { fakeBrowser } from 'wxt/testing/fake-browser';
import { storage } from 'wxt/utils/storage';
import { onMessage } from '@/infrastructure/browser/messages';
import { runMigrations } from '@/infrastructure/storage/migrations';
import { STORAGE_KEYS } from '@/infrastructure/storage/storage-keys';
import * as cards from '@/services/cards';
import * as setup from '@/services/gist-setup';
import * as auth from '@/services/github-auth';
import { triggerGistSync } from '@/services/github-sync';
import { getSettings } from '@/services/settings';
import { createDeferred } from '@/test/utils/deferred';
import { buildSettings } from '@/test/utils/settings-mocks';
import background from '../index';
import { messages } from '../message-handlers';

vi.mock('octokit', () => ({ Octokit: vi.fn() }));
vi.mock('@/infrastructure/browser/messages', () => ({ onMessage: vi.fn() }));
vi.mock('@/infrastructure/storage/migrations', () => ({ migrations: [], runMigrations: vi.fn() }));
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
    vi.mocked(runMigrations).mockResolvedValue(undefined);
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
    const migrations = createDeferred<void>();
    vi.mocked(runMigrations).mockReturnValue(migrations.promise);
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

  it('keeps alarm sync behind writes submitted through messaging', async () => {
    const writeStarted = createDeferred<void>();
    const releaseWrite = createDeferred<void>();
    const checked = createDeferred<void>();
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
