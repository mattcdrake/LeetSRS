import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fakeBrowser } from 'wxt/testing/fake-browser';
import { storage } from 'wxt/utils/storage';
import { readGistConnection } from '@/infrastructure/storage/gist-connection';
import { migrateBackupData, runStartupMigrations, setSchemaVersion } from '../runner';

describe('shared Gist connection migration', () => {
  beforeEach(() => fakeBrowser.reset());

  it.each([
    { legacy: {}, expected: { pat: '', gistId: null, enabled: false } },
    {
      legacy: { 'leetsrs:githubPat': ' token ', 'leetsrs:gistId': 'gist', 'leetsrs:gistSyncEnabled': true },
      expected: { pat: ' token ', gistId: 'gist', enabled: true },
    },
  ])('upgrades and reloads with legacy connection %j', async ({ legacy, expected }) => {
    await setSchemaVersion(4);
    await fakeBrowser.storage.sync.set<Record<string, unknown>>(legacy);
    await storage.setItem('local:leetsrs:lastSyncTime', 'local-status');
    const writes = vi.spyOn(fakeBrowser.storage.sync, 'set');

    await runStartupMigrations();
    await runStartupMigrations();

    expect(await readGistConnection()).toEqual(expected);
    expect(await fakeBrowser.storage.sync.get(null)).toEqual({ ...legacy, 'leetsrs:gistConnection': expected });
    expect(writes).toHaveBeenCalledExactlyOnceWith({ 'leetsrs:gistConnection': expected });
    expect(await storage.getItem('local:leetsrs:schemaVersion')).toBe(5);
    expect(await storage.getItem('local:leetsrs:lastSyncTime')).toBe('local-status');
  });
  it.each([
    { pat: 'shared', gistId: 'shared-gist', enabled: true },
    { pat: '', gistId: null, enabled: false },
    { pat: '', gistId: '', enabled: false },
  ])('preserves an already-written shared record %j over stale legacy input', async (connection) => {
    await setSchemaVersion(4);
    const installed = {
      'leetsrs:gistConnection': connection,
      'leetsrs:githubPat': 'stale-token',
      'leetsrs:gistId': 42,
      'leetsrs:gistSyncEnabled': 'invalid-stale-value',
    };
    await fakeBrowser.storage.sync.set(installed);
    await runStartupMigrations();
    expect(await readGistConnection()).toEqual(connection);
    expect(await fakeBrowser.storage.sync.get(null)).toEqual(installed);
  });

  it.each([
    { 'leetsrs:githubPat': 42 },
    { 'leetsrs:gistId': false },
    { 'leetsrs:gistSyncEnabled': 'true' },
    { 'leetsrs:gistConnection': null },
    { 'leetsrs:gistConnection': {} },
    { 'leetsrs:gistConnection': { pat: '', gistId: null, enabled: 'false' } },
  ])('rejects malformed installed connection before writes: %j', async (invalid) => {
    await setSchemaVersion(4);
    await fakeBrowser.storage.sync.set<Record<string, unknown>>(invalid);
    // The fake storage drops null entries; expose the raw browser snapshot for this case.
    if (invalid['leetsrs:gistConnection'] === null) {
      const snapshot = storage.snapshot.bind(storage);
      vi.spyOn(storage, 'snapshot').mockImplementation((area) =>
        area === 'sync' ? Promise.resolve(invalid) : snapshot(area)
      );
    }
    const localWrites = vi.spyOn(fakeBrowser.storage.local, 'set');
    const syncWrites = vi.spyOn(fakeBrowser.storage.sync, 'set');
    await expect(runStartupMigrations()).rejects.toThrow('Failed to run migration 5');
    expect(localWrites).not.toHaveBeenCalled();
    expect(syncWrites).not.toHaveBeenCalled();
    expect(await storage.getItem('local:leetsrs:schemaVersion')).toBe(4);
  });

  it.each(['save', 'completion'] as const)(
    'retries after %s failure without replacing a shared edit',
    async (stage) => {
      await setSchemaVersion(4);
      const legacy = {
        'leetsrs:githubPat': 'legacy',
        'leetsrs:gistId': 'legacy-gist',
        'leetsrs:gistSyncEnabled': true,
      };
      await fakeBrowser.storage.sync.set(legacy);
      const failure = vi
        .spyOn(stage === 'save' ? fakeBrowser.storage.sync : fakeBrowser.storage.local, 'set')
        .mockRejectedValueOnce(new Error('Unavailable'));
      await expect(runStartupMigrations()).rejects.toThrow('Failed to run migration 5');
      expect(await storage.getItem('local:leetsrs:schemaVersion')).toBe(4);
      expect(await storage.getItem('sync:leetsrs:gistConnection')).toEqual(
        stage === 'save' ? null : { pat: 'legacy', gistId: 'legacy-gist', enabled: true }
      );
      failure.mockRestore();
      // A shared edit can arrive before this browser retries its incomplete upgrade.
      const shared = { pat: '', gistId: null, enabled: false };
      await storage.setItem('sync:leetsrs:gistConnection', shared);
      await runStartupMigrations();
      expect(await readGistConnection()).toEqual(shared);
      expect(await fakeBrowser.storage.sync.get(null)).toEqual({ ...legacy, 'leetsrs:gistConnection': shared });
      expect(await storage.getItem('local:leetsrs:schemaVersion')).toBe(5);
    }
  );

  it.each([4, 5])('transforms schema %s backups without accessing the installed connection', (version) => {
    const snapshot = vi.spyOn(storage, 'snapshot').mockRejectedValue(new Error('No storage access'));
    const read = vi.spyOn(storage, 'getItem').mockRejectedValue(new Error('No storage access'));
    const write = vi.spyOn(storage, 'setItem');
    const data = Object.freeze({ cards: {}, stats: {}, gistSync: { gistId: 'backup', enabled: false } });
    expect(migrateBackupData(data, version)).toEqual(data);
    expect(snapshot).not.toHaveBeenCalled();
    expect(read).not.toHaveBeenCalled();
    expect(write).not.toHaveBeenCalled();
  });
});
