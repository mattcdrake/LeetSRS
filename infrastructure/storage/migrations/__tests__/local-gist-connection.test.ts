import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fakeBrowser } from 'wxt/testing/fake-browser';
import { storage } from 'wxt/utils/storage';
import { readSyncMetadata } from '../../sync-metadata';
import { readDataset } from '../layouts/v5';
import { migrateBackupData, runStartupMigrations, setSchemaVersion } from '../runner';

describe('device-local Gist connection migration', () => {
  beforeEach(() => fakeBrowser.reset());

  it.each([
    { name: 'fresh install', legacy: {}, expected: { pat: '', gistId: null, enabled: false } },
    {
      name: 'configured device',
      legacy: { 'leetsrs:githubPat': ' token ', 'leetsrs:gistId': 'gist', 'leetsrs:gistSyncEnabled': true },
      expected: { pat: ' token ', gistId: 'gist', enabled: true },
    },
    {
      name: 'partial setup',
      legacy: { 'leetsrs:githubPat': 'token' },
      expected: { pat: 'token', gistId: null, enabled: false },
    },
    {
      name: 'empty credentials',
      legacy: { 'leetsrs:githubPat': '', 'leetsrs:gistId': '', 'leetsrs:gistSyncEnabled': false },
      expected: { pat: '', gistId: '', enabled: false },
    },
  ])('upgrades $name in one connection write and retains legacy migration input', async ({ legacy, expected }) => {
    await setSchemaVersion(4);
    await fakeBrowser.storage.sync.set<Record<string, unknown>>(legacy);
    const writes = vi.spyOn(fakeBrowser.storage.local, 'set');

    await runStartupMigrations();
    await runStartupMigrations();

    expect(await readSyncMetadata('gistConnection')).toEqual(expected);
    expect(writes.mock.calls).toEqual([[{ 'leetsrs:gistConnection': expected }], [{ 'leetsrs:schemaVersion': 5 }]]);
    expect(await fakeBrowser.storage.sync.get(null)).toEqual(legacy);
    expect(await readSyncMetadata('dataUpdatedAt')).toBeNull();
  });

  it.each(['load', 'save', 'version'] as const)(
    'restarts after a failed %s without losing the connection',
    async (stage) => {
      await setSchemaVersion(4);
      const legacy = {
        'leetsrs:githubPat': 'original',
        'leetsrs:gistId': 'original-gist',
        'leetsrs:gistSyncEnabled': true,
      };
      await fakeBrowser.storage.sync.set(legacy);
      const write = storage.setItem.bind(storage);
      const failure = new Error('Storage unavailable');
      const failed =
        stage === 'load'
          ? vi.spyOn(storage, 'snapshot').mockRejectedValueOnce(failure)
          : vi.spyOn(storage, 'setItem').mockImplementation((key, value) => {
              if (key === (stage === 'save' ? 'local:leetsrs:gistConnection' : 'local:leetsrs:schemaVersion')) {
                return Promise.reject(failure);
              }
              return write(key, value);
            });

      await expect(runStartupMigrations()).rejects.toThrow('Storage unavailable');
      expect(await storage.getItem('local:leetsrs:schemaVersion')).toBe(4);
      expect(await readSyncMetadata('gistConnection')).toEqual(
        stage === 'version' ? { pat: 'original', gistId: 'original-gist', enabled: true } : null
      );
      expect(await fakeBrowser.storage.sync.get(null)).toEqual(legacy);
      failed.mockRestore();
      if (stage === 'version') await storage.setItem('sync:leetsrs:githubPat', 'changed-on-another-device');

      await runStartupMigrations();
      await runStartupMigrations();

      expect(await readSyncMetadata('gistConnection')).toEqual({
        pat: 'original',
        gistId: 'original-gist',
        enabled: true,
      });
      expect(await storage.getItem('local:leetsrs:schemaVersion')).toBe(5);
    }
  );

  it.each([
    { pat: 'local', gistId: 'local-gist', enabled: true },
    { pat: '', gistId: null, enabled: false },
  ])('prefers an already-written local record, including explicit defaults: %j', async (connection) => {
    await setSchemaVersion(4);
    await storage.setItem('local:leetsrs:gistConnection', connection);
    // Malformed stale fields must not override or invalidate a complete destination.
    const legacy = { 'leetsrs:githubPat': 42, 'leetsrs:gistId': 42, 'leetsrs:gistSyncEnabled': 'yes' };
    await fakeBrowser.storage.sync.set(legacy);
    await runStartupMigrations();
    expect(await readSyncMetadata('gistConnection')).toEqual(connection);
    expect(await fakeBrowser.storage.sync.get(null)).toEqual(legacy);
    expect(await readDataset()).toEqual({ settings: {}, gistSync: connection });
  });

  it('migrates fresh storage and keeps backup transformations independent of the installed connection', async () => {
    await runStartupMigrations();
    expect(await readSyncMetadata('gistConnection')).toEqual({ pat: '', gistId: null, enabled: false });
    const input = Object.freeze({
      cards: {},
      settings: {},
      gistSync: Object.freeze({ gistId: 'backup-gist', enabled: true }),
    });
    const snapshots = vi.spyOn(storage, 'snapshot').mockRejectedValue(new Error('No storage access'));
    const reads = vi.spyOn(storage, 'getItem').mockRejectedValue(new Error('No storage access'));
    const writes = vi.spyOn(storage, 'setItem').mockRejectedValue(new Error('No storage access'));
    expect(migrateBackupData(input, 4)).toBe(input);
    expect(migrateBackupData(input, 5)).toBe(input);
    expect(snapshots).not.toHaveBeenCalled();
    expect(reads).not.toHaveBeenCalled();
    expect(writes).not.toHaveBeenCalled();
  });

  it.each([
    { area: 'sync', key: 'leetsrs:githubPat', value: 42 },
    { area: 'sync', key: 'leetsrs:gistId', value: false },
    { area: 'sync', key: 'leetsrs:gistSyncEnabled', value: 'true' },
    { area: 'local', key: 'leetsrs:gistConnection', value: { pat: 'token' } },
  ] as const)('rejects malformed $key before writing the connection or completion', async ({ area, key, value }) => {
    await setSchemaVersion(4);
    await fakeBrowser.storage[area].set<Record<string, unknown>>({ [key]: value });
    const writes = vi.spyOn(fakeBrowser.storage.local, 'set');
    await expect(runStartupMigrations()).rejects.toThrow('Failed to run migration 5');
    expect(writes).not.toHaveBeenCalled();
    expect(await storage.getItem('local:leetsrs:schemaVersion')).toBe(4);
  });
});
