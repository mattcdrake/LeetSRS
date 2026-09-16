import { beforeEach, expect, it } from 'vitest';
import { fakeBrowser } from 'wxt/testing/fake-browser';
import type { GistSyncConfig } from '@/shared/models';
import { readGistConnection, writeGistConnection } from '@/shared/storage';

beforeEach(() => fakeBrowser.reset());

it.each<GistSyncConfig>([
  { accountId: null, gistId: null, enabled: false },
  { accountId: 1, gistId: 'gist', enabled: false },
  { accountId: 1, gistId: 'gist', enabled: true },
])('round-trips a valid connection %j', async (connection) => {
  await writeGistConnection(connection);

  expect(await readGistConnection()).toEqual(connection);
});

it.each([
  { accountId: null, gistId: null, enabled: true },
  ...[false, true].flatMap((enabled) => [
    { accountId: null, gistId: 'gist', enabled },
    { accountId: 1, gistId: null, enabled },
    { accountId: 1, gistId: '', enabled },
    { accountId: 1, gistId: ' \t ', enabled },
  ]),
  ...[0, -1, 1.5].map((accountId) => ({ accountId, gistId: 'gist', enabled: false })),
])('rejects invalid stored connection %j', async (connection) => {
  await fakeBrowser.storage.local.set({ 'leetsrs:gistConnection': connection });

  await expect(readGistConnection()).rejects.toThrow();
});
