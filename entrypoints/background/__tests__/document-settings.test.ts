import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fakeBrowser } from 'wxt/testing/fake-browser';
import { storage } from 'wxt/utils/storage';
import { onMessage } from '@/infrastructure/browser/messages';
import { readLearningDocument, replaceLearningDocument } from '@/infrastructure/storage/learning-document';
import { getSettings } from '@/infrastructure/storage/learning-queries';
import { STORAGE_KEYS } from '@/infrastructure/storage/storage-keys';
import { dispatchBackgroundCommand as dispatch } from '@/test/utils/background-messages';
import { mixedRecordBackup } from '@/test/utils/backup-mocks';
import { buildSettings } from '@/test/utils/settings-mocks';
import background from '../index';

vi.mock('@/infrastructure/browser/messages', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/infrastructure/browser/messages')>()),
  onMessage: vi.fn(),
}));

describe('document settings through background commands', () => {
  beforeEach(() => {
    fakeBrowser.reset();
    fakeBrowser.runtime.id = 'test';
    vi.mocked(onMessage).mockClear();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it('resolves defaults and browser language without storing them or reading stale settings', async () => {
    vi.stubGlobal('navigator', { languages: ['pl'] });
    await replaceLearningDocument({ schemaVersion: 6, cards: {}, stats: {}, settings: { theme: 'dark' } });
    await storage.setItem(STORAGE_KEYS.theme, 'light');
    await storage.setItem(STORAGE_KEYS.language, 'de');
    background.main();

    expect(await getSettings()).toEqual(buildSettings({ theme: 'dark', language: 'pl' }));
    vi.stubGlobal('navigator', { languages: ['de'] });
    expect(await getSettings()).toEqual(buildSettings({ theme: 'dark', language: 'de' }));
    expect(await readLearningDocument()).toEqual({
      schemaVersion: 6,
      cards: {},
      stats: {},
      settings: { theme: 'dark' },
    });
  });

  it('saves explicit overrides and their timestamp together while preserving learning data and connection state', async () => {
    const { embedded, payload } = mixedRecordBackup();
    const document = { ...embedded, schemaVersion: 6 as const, settings: {}, dataUpdatedAt: payload.dataUpdatedAt };
    await replaceLearningDocument(document);
    await storage.setItem(STORAGE_KEYS.gistConnection, { pat: 'secret', gistId: 'gist', enabled: true });
    await storage.setItem(STORAGE_KEYS.lastSyncTime, payload.dataUpdatedAt);
    background.main();
    await dispatch('waitForInitialization');
    const sync = await fakeBrowser.storage.sync.get();
    const writes = vi.spyOn(fakeBrowser.storage.local, 'set');
    const now = new Date('2026-09-12T12:00:00.000Z');
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(now);

    const changes = {
      maxNewCardsPerDay: 0,
      theme: 'system',
      language: 'en',
      badgeEnabled: false,
      resetEditorOnEveryProblem: false,
      resetEditorOnDueReview: true,
    } as const;
    await dispatch('updateSettings', { changes });

    expect(await getSettings()).toEqual(changes);
    expect(await readLearningDocument()).toEqual({ ...document, settings: changes, dataUpdatedAt: now.toISOString() });
    expect(writes).toHaveBeenCalledOnce();
    expect(await fakeBrowser.storage.sync.get()).toEqual(sync);
    expect(await storage.getItem(STORAGE_KEYS.lastSyncTime)).toBe(payload.dataUpdatedAt);
    expect(await storage.getItem(STORAGE_KEYS.dataUpdatedAt)).toBeNull();
  });

  it.each(['validation', 'clock', 'write'] as const)(
    'preserves the document after a %s failure and accepts the next edit',
    async (failure) => {
      const { embedded, payload } = mixedRecordBackup();
      const document = {
        ...embedded,
        schemaVersion: 6 as const,
        dataUpdatedAt: payload.dataUpdatedAt,
        settings: { language: 'de' as const, theme: 'dark' as const },
      };
      await replaceLearningDocument(document);
      background.main();
      const before = await getSettings();
      const writes = vi.spyOn(fakeBrowser.storage.local, 'set');
      if (failure === 'write') {
        writes.mockRejectedValueOnce(new Error('Write failed'));
      }
      if (failure === 'clock') {
        vi.useFakeTimers({ toFake: ['Date'] });
        vi.setSystemTime(Number.NaN);
      }

      await expect(
        dispatch('updateSettings', {
          changes: { theme: 'light', maxNewCardsPerDay: failure === 'validation' ? -1 : 8 },
        })
      ).rejects.toThrow();
      vi.useRealTimers();
      expect(await getSettings()).toEqual(before);
      expect(await readLearningDocument()).toEqual(document);
      expect(writes).toHaveBeenCalledTimes(failure === 'write' ? 1 : 0);

      await dispatch('updateSettings', { changes: { theme: 'light' } });
      expect(await getSettings()).toEqual(buildSettings({ theme: 'light', language: 'de' }));
      expect((await readLearningDocument())?.settings).toEqual({ theme: 'light', language: 'de' });
    }
  );

  it('ignores empty, undefined, unknown, and inherited updates without materializing defaults', async () => {
    background.main();
    await dispatch('waitForInitialization');
    const writes = vi.spyOn(fakeBrowser.storage.local, 'set');
    const changes = Object.assign(Object.create({ badgeEnabled: false }), { theme: undefined, unknown: 1 });
    const before = await readLearningDocument();
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(Number.NaN);

    await dispatch('updateSettings', { changes: {} });
    await dispatch('updateSettings', { changes });

    expect(writes).not.toHaveBeenCalled();
    expect(await readLearningDocument()).toEqual(before);
    vi.useRealTimers();
    await dispatch('updateSettings', { changes: { theme: undefined, maxNewCardsPerDay: 5 } });
    expect((await readLearningDocument())?.settings).toEqual({ maxNewCardsPerDay: 5 });
  });

  it('resolves each read from its captured document and follows replacement without retained overrides', async () => {
    vi.stubGlobal('navigator', { languages: ['pl'] });
    const document = {
      schemaVersion: 6 as const,
      cards: {},
      stats: {},
      settings: { language: 'de' as const, theme: 'dark' as const },
    };
    await replaceLearningDocument(document);
    background.main();
    await dispatch('waitForInitialization');
    const initial = Promise.withResolvers<typeof document>();
    const started = Promise.withResolvers<void>();
    const reads = vi.spyOn(storage, 'getItem').mockImplementationOnce(() => {
      started.resolve();
      return initial.promise;
    });

    const pending = getSettings();
    await started.promise;
    await replaceLearningDocument({ schemaVersion: 6, cards: {}, stats: {}, settings: {} });
    initial.resolve(document);
    expect(await pending).toEqual(buildSettings({ language: 'de', theme: 'dark' }));
    expect(reads).toHaveBeenCalledExactlyOnceWith(STORAGE_KEYS.learningDocument);
    expect(await getSettings()).toEqual(buildSettings({ language: 'pl' }));
  });
});
