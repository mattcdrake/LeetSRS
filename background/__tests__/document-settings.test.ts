import { registerService } from '@webext-core/proxy-service';
import { State } from 'ts-fsrs';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fakeBrowser } from 'wxt/testing/fake-browser';
import { storage } from 'wxt/utils/storage';
import { gistConnectionItem, lastSyncTimeItem, readLearningDocument, replaceLearningDocument } from '@/shared/storage';
import { getRegisteredBackground } from '@/test/utils/background-service';
import { createMockCard } from '@/test/utils/card-mocks';
import { seedGithubAuthorization } from '@/test/utils/github-auth';
import { buildLearningDocument } from '@/test/utils/learning-document-mocks';
import { getSettings } from '@/test/utils/learning-reads';
import { buildSettings } from '@/test/utils/settings-mocks';
import backgroundEntry from '../../entrypoints/background/index';

vi.mock('@webext-core/proxy-service', () => import('@/test/mocks/proxy-service'));

describe('document settings through background commands', () => {
  beforeEach(() => {
    fakeBrowser.reset();
    fakeBrowser.runtime.id = 'test';
    vi.mocked(registerService).mockClear();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it('resolves defaults and browser language without storing them or reading stale settings', async () => {
    vi.stubGlobal('navigator', { languages: ['en'] });
    const document = buildLearningDocument({ settings: { theme: 'dark' } });
    await replaceLearningDocument(document);
    await storage.setItem('sync:leetsrs:theme', 'light');
    await storage.setItem('sync:leetsrs:language', 'zh-CN');
    backgroundEntry.main();

    expect(await getSettings()).toEqual(buildSettings({ theme: 'dark', language: 'en' }));
    vi.stubGlobal('navigator', { languages: ['zh-CN'] });
    expect(await getSettings()).toEqual(buildSettings({ theme: 'dark', language: 'zh-CN' }));
    expect(await readLearningDocument()).toEqual(document);
  });

  it('saves explicit overrides and their timestamp together while preserving learning data and connection state', async () => {
    const document = buildLearningDocument({
      cards: { '1': createMockCard(State.Review, { frontendId: '1', paused: true, note: 'Keep this note' }) },
      reviewActivity: { date: '2024-01-01', newCards: 0, streak: 1 },
      dataUpdatedAt: '2024-01-15T10:00:00.000Z',
    });
    await replaceLearningDocument(document);
    await seedGithubAuthorization();
    await gistConnectionItem.setValue({ accountId: 1, gistId: 'gist', enabled: true });
    await lastSyncTimeItem.setValue('2024-01-15T10:00:00.000Z');
    backgroundEntry.main();
    await getRegisteredBackground().waitForInitialization();
    const sync = await fakeBrowser.storage.sync.get();
    const writes = vi.spyOn(fakeBrowser.storage.local, 'set');
    const now = new Date('2026-09-12T12:00:00.000Z');
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(now);

    const changes = {
      maxNewCardsPerDay: 0,
      theme: 'system',
      language: 'en',
      preferredLeetcodeSite: 'leetcode.cn',
      resetEditorOnReviewQueue: true,
      openRatingAfterSolving: false,
    } as const;
    await getRegisteredBackground().updateSettings(changes);

    expect(await getSettings()).toEqual(changes);
    expect(await readLearningDocument()).toEqual({ ...document, settings: changes, dataUpdatedAt: now.toISOString() });
    expect(writes).toHaveBeenCalledOnce();
    expect(await fakeBrowser.storage.sync.get()).toEqual(sync);
    expect(await lastSyncTimeItem.getValue()).toBe('2024-01-15T10:00:00.000Z');
    expect(await storage.getItem('local:leetsrs:dataUpdatedAt')).toBeNull();
  });

  it.each(['validation', 'write'] as const)(
    'preserves the document after a %s failure and accepts the next edit',
    async (failure) => {
      const document = buildLearningDocument({
        cards: { '1': createMockCard(State.Review, { frontendId: '1', paused: true, note: 'Keep this note' }) },
        reviewActivity: { date: '2024-01-01', newCards: 0, streak: 1 },
        dataUpdatedAt: '2024-01-15T10:00:00.000Z',
        settings: { language: 'zh-CN' as const, theme: 'dark' as const },
      });
      await replaceLearningDocument(document);
      backgroundEntry.main();
      await getRegisteredBackground().waitForInitialization();
      const before = await getSettings();
      const writes = vi.spyOn(fakeBrowser.storage.local, 'set');
      if (failure === 'write') {
        writes.mockRejectedValueOnce(new Error('Write failed'));
      }

      await expect(
        getRegisteredBackground().updateSettings({
          theme: 'light',
          maxNewCardsPerDay: failure === 'validation' ? -1 : 8,
        })
      ).rejects.toThrow();
      expect(await getSettings()).toEqual(before);
      expect(await readLearningDocument()).toEqual(document);
      expect(writes).toHaveBeenCalledTimes(failure === 'write' ? 1 : 0);

      await getRegisteredBackground().updateSettings({ theme: 'light' });
      expect(await getSettings()).toEqual(buildSettings({ theme: 'light', language: 'zh-CN' }));
      expect((await readLearningDocument())?.settings).toEqual({ theme: 'light', language: 'zh-CN' });
    }
  );

  it('ignores empty, undefined, unknown, and inherited updates without materializing defaults', async () => {
    backgroundEntry.main();
    await getRegisteredBackground().waitForInitialization();
    const writes = vi.spyOn(fakeBrowser.storage.local, 'set');
    const changes = Object.assign(Object.create({ language: 'zh-CN' }), { theme: undefined, unknown: 1 });
    const before = await readLearningDocument();

    await getRegisteredBackground().updateSettings({});
    await getRegisteredBackground().updateSettings(changes);

    expect(writes).not.toHaveBeenCalled();
    expect(await readLearningDocument()).toEqual(before);
    await getRegisteredBackground().updateSettings({ theme: undefined, maxNewCardsPerDay: 5 });
    expect((await readLearningDocument())?.settings).toEqual({
      maxNewCardsPerDay: 5,
      resetEditorOnReviewQueue: false,
    });
  });
});
