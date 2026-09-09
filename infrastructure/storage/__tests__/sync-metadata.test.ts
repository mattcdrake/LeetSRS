import { beforeEach, describe, expect, it } from 'vitest';
import { fakeBrowser } from 'wxt/testing/fake-browser';
import { storage } from 'wxt/utils/storage';
import { ZodError } from 'zod';
import { STORAGE_KEYS } from '../storage-keys';
import { readSyncMetadata } from '../sync-metadata';

type MetadataKey = Parameters<typeof readSyncMetadata>[0];
const cases: [MetadataKey, unknown, unknown[]][] = [
  ['githubPat', ' token ', [42, {}, []]],
  ['gistId', '', [42, false, {}]],
  ['gistSyncEnabled', false, ['false', 0, {}]],
  ['lastSyncTime', '2024-01-01T00:00:00.000Z', [42, {}, []]],
  ['lastSyncDirection', 'pull', ['invalid', true, {}]],
  ['dataUpdatedAt', '2024-01-01T00:00:00.000Z', [42, {}, []]],
];

describe('sync metadata decoding', () => {
  beforeEach(() => fakeBrowser.reset());

  it.each(cases)('returns null for missing %s and preserves valid values', async (key, value) => {
    expect(await readSyncMetadata(key)).toBeNull();
    await storage.setItem(STORAGE_KEYS[key], value);
    expect(await readSyncMetadata(key)).toBe(value);
    await storage.setItem(STORAGE_KEYS[key], null);
    expect(await readSyncMetadata(key)).toBeNull();
  });

  it.each(cases.flatMap(([key, _valid, invalid]) => invalid.map((value): [MetadataKey, unknown] => [key, value])))(
    'rejects invalid %s: %j without rewriting storage',
    async (key, value) => {
      await storage.setItem(STORAGE_KEYS[key], value);
      await expect(readSyncMetadata(key)).rejects.toBeInstanceOf(ZodError);
      expect(await storage.getItem(STORAGE_KEYS[key])).toEqual(value);
    }
  );
});
