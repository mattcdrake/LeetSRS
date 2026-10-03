import { registerService } from '@webext-core/proxy-service';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { browser } from 'wxt/browser';
import { fakeBrowser } from 'wxt/testing/fake-browser';
import { ZodError } from 'zod';
import type { BackgroundService } from '@/shared/background-service';
import { readGistConnection, writeGistConnection } from '@/shared/gist-sync';
import { readLearningDocument } from '@/shared/learning-document';
import { getRegisteredBackground } from '@/test/utils/background-service';
import { buildProblem } from '@/test/utils/card-mocks';
import { seedGithubAuthorization } from '@/test/utils/github-auth';
import { buildLearningDocument } from '@/test/utils/learning-document-mocks';
import backgroundEntry from '../../entrypoints/background/index';

vi.mock('@webext-core/proxy-service', () => import('@/test/mocks/proxy-service'));

beforeEach(async () => {
  fakeBrowser.reset();
  fakeBrowser.runtime.id = 'test';
  vi.mocked(registerService).mockClear();
  backgroundEntry.main();
  await getRegisteredBackground().waitForInitialization();
  await new Promise((resolve) => setTimeout(resolve, 0));
});

const problem = buildProblem();
const savedConnection = { accountId: 1, gistId: 'gist', enabled: false };

describe('registered background execution', () => {
  it('resets learning data and authorization without deleting unrelated storage', async () => {
    await getRegisteredBackground().rateCard({ ...problem, rating: 3 });
    await getRegisteredBackground().saveNote('1', 'Reset me');
    await getRegisteredBackground().updateSettings({ language: 'zh-CN' });
    await seedGithubAuthorization();
    await writeGistConnection(savedConnection);
    await fakeBrowser.storage.local.set({ 'leetsrs:lastSyncTime': 'old', unrelated: 'keep' });
    await fakeBrowser.storage.sync.set({ unrelated: 'keep' });

    await getRegisteredBackground().resetAllData();

    expect(await readLearningDocument()).toEqual(buildLearningDocument());
    expect(await readGistConnection()).toEqual({ accountId: null, gistId: null, enabled: false });
    expect((await getRegisteredBackground().getGithubAuthStatus()).account).toBeNull();
    expect(await getRegisteredBackground().getGistSyncStatus()).toEqual({
      lastSyncTime: null,
      syncInProgress: false,
      lastError: null,
    });
    expect(await fakeBrowser.storage.local.get('unrelated')).toEqual({ unrelated: 'keep' });
    expect(await fakeBrowser.storage.sync.get()).toEqual({ unrelated: 'keep' });
  });
});

const invalidArguments: [keyof BackgroundService, unknown[]][] = [
  ['acknowledgePopupDialog', ['']],
  ['rateCard', [{ ...problem, rating: 0 }]],
  ['saveNote', ['card', 'note', 'extra']],
];

it.each(invalidArguments)(
  'rejects invalid %s input before mutation and accepts a later valid edit',
  async (name, invalid) => {
    const writes = vi.spyOn(browser.storage.local, 'set');
    const badge = vi.spyOn(browser.action, 'setBadgeText');
    await expect(Reflect.apply(getRegisteredBackground()[name], undefined, invalid)).rejects.toBeInstanceOf(ZodError);
    expect(writes).not.toHaveBeenCalled();
    expect(badge).not.toHaveBeenCalled();
    await getRegisteredBackground().addCard(buildProblem({ frontendId: 'card' }));
    await getRegisteredBackground().saveNote('card', 'after failure');
    expect((await readLearningDocument()).cards.card?.note ?? null).toBe('after failure');
  }
);
