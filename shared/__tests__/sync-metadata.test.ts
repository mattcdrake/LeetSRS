import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fakeBrowser } from 'wxt/testing/fake-browser';
import { storage } from 'wxt/utils/storage';
import { ZodError } from 'zod';
import { readSyncStatus, STORAGE_KEYS } from '@/shared/storage';

const cases = [
  ['lastSyncTime', '2024-01-01T00:00:00.000Z', 42],
  ['lastSyncDirection', 'pull', 'invalid'],
] as const;

describe('sync status decoding', () => {
  beforeEach(() => fakeBrowser.reset());

  it.each(cases)('batch reads and decodes missing, valid, and invalid %s', async (key, value, invalid) => {
    const read = vi.spyOn(fakeBrowser.storage.local, 'get');

    expect((await readSyncStatus())[key]).toBeNull();
    expect(read).toHaveBeenCalledExactlyOnceWith(['leetsrs:lastSyncTime', 'leetsrs:lastSyncDirection']);
    await storage.setItem(STORAGE_KEYS[key], value);
    expect((await readSyncStatus())[key]).toBe(value);
    await storage.setItem(STORAGE_KEYS[key], invalid);
    await expect(readSyncStatus()).rejects.toBeInstanceOf(ZodError);
    expect(await storage.getItem(STORAGE_KEYS[key])).toEqual(invalid);
  });
});
