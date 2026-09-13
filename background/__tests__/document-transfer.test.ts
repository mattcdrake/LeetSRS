import { beforeEach, describe, expect, it, vi } from 'vitest';
import { browser } from 'wxt/browser';
import { fakeBrowser } from 'wxt/testing/fake-browser';
import { readGistConnection } from '@/data/gist-connection';
import { readLearningDocument } from '@/data/learning-document';
import { getSettings } from '@/data/learning-queries';
import { onMessage } from '@/integrations/browser/messages';
import { dispatchBackgroundCommand as dispatch } from '@/test/utils/background-messages';
import { validLegacyBackup } from '@/test/utils/backup-mocks';
import { buildProblem } from '@/test/utils/card-mocks';
import background from '../../entrypoints/background/index';

const github = vi.hoisted(() => ({ get: vi.fn(), update: vi.fn(), create: vi.fn() }));
vi.mock('octokit', () => ({
  Octokit: vi.fn(function MockOctokit() {
    return { rest: { gists: github } };
  }),
}));
vi.mock('@/integrations/browser/messages', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/integrations/browser/messages')>()),
  onMessage: vi.fn(),
}));

beforeEach(async () => {
  fakeBrowser.reset();
  fakeBrowser.runtime.id = 'test';
  vi.mocked(onMessage).mockClear();
  background.main();
  await dispatch('waitForInitialization');
  await dispatch('resetAllData');
  await fakeBrowser.storage.sync.set({ 'leetsrs:gistConnection': { pat: 'secret', gistId: 'gist', enabled: false } });
});

describe('file and Gist transfers through registered background commands', () => {
  it.each(['file', 'gist'] as const)(
    'replaces the whole document from a %s and preserves its timestamp and connection',
    async (source) => {
      await dispatch('addCard', { problem: buildProblem() });
      await dispatch('saveNote', { slug: 'two-sum', text: 'Omitted from replacement' });
      await dispatch('updateSettings', { changes: { theme: 'dark', language: 'de' } });
      await fakeBrowser.storage.local.set({ 'leetsrs:lastSyncTime': 'previous', 'leetsrs:lastSyncDirection': 'push' });
      const before = await readLearningDocument();
      const replacement = { ...before, settings: {}, dataUpdatedAt: '2099-01-01T00:00:00.000Z' };
      delete replacement.cards['two-sum'].note;
      const jsonData = JSON.stringify(replacement);
      const writes = vi.spyOn(fakeBrowser.storage.local, 'set');
      if (source === 'file') {
        await dispatch('importData', { jsonData });
        expect(await dispatch('getGistSyncStatus')).toMatchObject({
          lastSyncTime: 'previous',
          lastSyncDirection: 'push',
        });
      } else {
        github.get.mockResolvedValue({ data: { files: { 'leetsrs-backup.json': { content: jsonData } } } });
        await expect(dispatch('triggerGistSync')).resolves.toMatchObject({ success: true, action: 'pulled' });
        expect(await dispatch('getGistSyncStatus')).toMatchObject({ lastSyncDirection: 'pull' });
      }
      expect(await readLearningDocument()).toEqual(replacement);
      expect((await readLearningDocument()).cards['two-sum']?.note ?? null).toBeNull();
      expect(await getSettings()).toMatchObject({ theme: 'system' });
      expect(await readGistConnection()).toEqual({ pat: 'secret', gistId: 'gist', enabled: false });
      const documentWrites = writes.mock.calls.filter(([items]) => Object.hasOwn(items, 'leetsrs:learningDocument'));
      expect(documentWrites).toEqual([[{ 'leetsrs:learningDocument': replacement }]]);
      expect(github.update).not.toHaveBeenCalled();
    }
  );

  it.each([true, false])(
    'imports historical data with an explicit timestamp: %s without importing its connection',
    async (hasTimestamp) => {
      const { backup, converted } = validLegacyBackup();
      const input = { ...backup, dataUpdatedAt: hasTimestamp ? backup.dataUpdatedAt : undefined };
      await dispatch('importData', { jsonData: JSON.stringify(input) });
      expect(await readLearningDocument()).toEqual({
        schemaVersion: 6,
        ...converted,
        settings: {},
        dataUpdatedAt: hasTimestamp ? backup.dataUpdatedAt : backup.exportDate,
      });
      expect(await readGistConnection()).toEqual({ pat: 'secret', gistId: 'gist', enabled: false });
      expect((await readLearningDocument()).cards['two-sum']?.note ?? null).toBe('Keep this note');
    }
  );

  it.each(['file', 'gist'] as const)(
    'retains all data after a rejected %s replacement and accepts a later command',
    async (source) => {
      await dispatch('addCard', { problem: buildProblem() });
      const before = await readLearningDocument();
      const config = await readGistConnection();
      const jsonData = JSON.stringify({
        schemaVersion: 6,
        cards: {},
        stats: {},
        settings: {},
        dataUpdatedAt: '2099-01-01T00:00:00.000Z',
      });
      vi.spyOn(fakeBrowser.storage.local, 'set').mockRejectedValueOnce(new Error('Document unavailable'));
      if (source === 'file') {
        await expect(dispatch('importData', { jsonData })).rejects.toThrow('Document unavailable');
      } else {
        github.get.mockResolvedValue({ data: { files: { 'leetsrs-backup.json': { content: jsonData } } } });
        await expect(dispatch('triggerGistSync')).resolves.toEqual({ success: false, error: 'Document unavailable' });
      }
      expect(await readLearningDocument()).toEqual(before);
      expect(await readGistConnection()).toEqual(config);
      expect(await dispatch('getGistSyncStatus')).toMatchObject({ lastSyncTime: null, lastSyncDirection: null });
      await dispatch('saveNote', { slug: 'two-sum', text: 'After failure' });
      expect((await readLearningDocument()).cards['two-sum']?.note ?? null).toBe('After failure');
    }
  );

  it.each(['file', 'gist'] as const)(
    'rejects future %s data before overwriting either side, even when local data is newer',
    async (source) => {
      await dispatch('addCard', { problem: buildProblem() });
      const before = await readLearningDocument();
      const jsonData = JSON.stringify({
        schemaVersion: 7,
        cards: {},
        stats: {},
        settings: {},
        dataUpdatedAt: '2000-01-01T00:00:00.000Z',
      });
      const writes = vi.spyOn(fakeBrowser.storage.local, 'set');
      if (source === 'file') {
        await expect(dispatch('importData', { jsonData })).rejects.toThrow();
      } else {
        github.get.mockResolvedValue({ data: { files: { 'leetsrs-backup.json': { content: jsonData } } } });
        await expect(dispatch('triggerGistSync')).resolves.toMatchObject({ success: false });
      }
      expect(await readLearningDocument()).toEqual(before);
      expect(writes).not.toHaveBeenCalled();
      expect(github.update).not.toHaveBeenCalled();
    }
  );

  it('refreshes the badge after a pull even when its status write fails', async () => {
    await dispatch('addCard', { problem: buildProblem() });
    const remote = { ...(await readLearningDocument()), cards: {}, dataUpdatedAt: '2099-01-01T00:00:00.000Z' };
    github.get.mockResolvedValue({ data: { files: { 'leetsrs-backup.json': { content: JSON.stringify(remote) } } } });
    const write = fakeBrowser.storage.local.set.bind(fakeBrowser.storage.local);
    vi.spyOn(fakeBrowser.storage.local, 'set').mockImplementation(async (items) => {
      if ('leetsrs:lastSyncTime' in items) throw new Error('status failed');
      await write(items);
    });
    const badge = vi.spyOn(browser.action, 'setBadgeText');
    expect(await dispatch('triggerGistSync')).toEqual({ success: false, error: 'status failed' });
    expect(Object.values((await readLearningDocument()).cards)).toEqual([]);
    expect(badge).toHaveBeenLastCalledWith({ text: '' });
  });

  it.each([
    { enabled: false, pat: 'secret', gistId: 'gist' },
    { enabled: true, pat: '', gistId: 'gist' },
    { enabled: true, pat: 'secret', gistId: null },
  ])('skips automatic sync when its connection is incomplete: %j', async (config) => {
    await fakeBrowser.storage.sync.set({ 'leetsrs:gistConnection': config });
    const registration = vi.spyOn(browser.alarms.onAlarm, 'addListener');
    background.main();
    const alarm = registration.mock.calls[0][0];
    await alarm({ name: 'gist-sync', scheduledTime: Date.now(), periodInMinutes: 1, persistAcrossSessions: true });
    expect(github.get).not.toHaveBeenCalled();
  });

  it('creates a Gist from the document without treating connection changes as learning edits', async () => {
    await dispatch('updateSettings', { changes: { language: 'de' } });
    const before = await readLearningDocument();
    github.create.mockResolvedValueOnce({ data: { id: 'created-gist' } });
    github.get.mockResolvedValue({ data: { files: {} } });
    await expect(dispatch('setupGistSync', { mode: 'create', pat: 'entered' })).resolves.toMatchObject({
      saved: true,
      sync: { success: true },
    });
    expect(JSON.parse(github.create.mock.calls[0][0].files['leetsrs-backup.json'].content)).toEqual(before);
    expect(await readGistConnection()).toEqual({ pat: 'entered', gistId: 'created-gist', enabled: false });
    await dispatch('setGistSyncEnabled', { enabled: false });
    expect(await readLearningDocument()).toEqual(before);
    expect(await fakeBrowser.storage.local.get('leetsrs:dataUpdatedAt')).toEqual({});
  });
});
