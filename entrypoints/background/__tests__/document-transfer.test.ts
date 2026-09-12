import { beforeEach, describe, expect, it, vi } from 'vitest';
import { browser } from 'wxt/browser';
import { fakeBrowser } from 'wxt/testing/fake-browser';
import { type LearningDocument, learningDocumentSchema } from '@/domain/learning-document';
import { type MessageData, type MessageName, onMessage } from '@/infrastructure/browser/messages';
import { mixedRecordBackup } from '@/test/utils/backup-mocks';
import { buildProblem } from '@/test/utils/card-mocks';
import background from '../index';

const github = vi.hoisted(() => ({ get: vi.fn(), update: vi.fn(), create: vi.fn() }));
vi.mock('octokit', () => ({
  Octokit: vi.fn(function MockOctokit() {
    return { rest: { gists: github } };
  }),
}));
vi.mock('@/infrastructure/browser/messages', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/infrastructure/browser/messages')>()),
  onMessage: vi.fn(),
}));

function dispatch(name: MessageName, data?: unknown) {
  const listener = vi.mocked(onMessage).mock.calls.find(([registered]) => registered === name)?.[1];
  if (!listener) throw new Error(`Missing listener for ${name}`);
  return listener({ id: 1, type: name, data: data as MessageData<MessageName>, timestamp: 0, sender: {} });
}

async function exported(): Promise<LearningDocument> {
  return learningDocumentSchema.parse(JSON.parse((await dispatch('exportData')) as string));
}

beforeEach(async () => {
  fakeBrowser.reset();
  fakeBrowser.runtime.id = 'test';
  vi.mocked(onMessage).mockClear();
  background.main();
  await dispatch('getSettings');
  await dispatch('resetAllData');
  await dispatch('setGistSyncConfig', { config: { pat: 'secret', gistId: 'gist', enabled: true } });
});

describe('file and Gist transfers through registered background commands', () => {
  it.each(['file', 'gist'] as const)(
    'replaces the whole document from a %s and preserves its timestamp and connection',
    async (source) => {
      await dispatch('addCard', { problem: buildProblem() });
      await dispatch('saveNote', { slug: 'two-sum', text: 'Omitted from replacement' });
      await dispatch('updateSettings', { changes: { theme: 'dark', language: 'de' } });
      await fakeBrowser.storage.local.set({ 'leetsrs:lastSyncTime': 'previous', 'leetsrs:lastSyncDirection': 'push' });
      const before = await exported();
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
      expect(await exported()).toEqual(replacement);
      expect(await dispatch('getNote', { slug: 'two-sum' })).toBeNull();
      expect(await dispatch('getSettings')).toMatchObject({ theme: 'system' });
      expect(await dispatch('getGistSyncConfig')).toEqual({ pat: 'secret', gistId: 'gist', enabled: true });
      const documentWrites = writes.mock.calls.filter(([items]) => Object.hasOwn(items, 'leetsrs:learningDocument'));
      expect(documentWrites).toEqual([[{ 'leetsrs:learningDocument': replacement }]]);
      expect(github.update).not.toHaveBeenCalled();
    }
  );

  it('imports supported historical data without importing its connection', async () => {
    const { accepted, embedded, payload } = mixedRecordBackup();
    await dispatch('importData', { jsonData: JSON.stringify({ ...payload, data: accepted }) });
    expect(await exported()).toEqual({
      schemaVersion: 6,
      ...embedded,
      settings: {},
      dataUpdatedAt: payload.dataUpdatedAt,
    });
    expect(await dispatch('getGistSyncConfig')).toEqual({ pat: 'secret', gistId: 'gist', enabled: true });
    expect(await dispatch('getNote', { slug: 'two-sum' })).toBe('Keep this note');
  });

  it.each(['file', 'gist'] as const)(
    'retains all data after a rejected %s replacement and accepts a later command',
    async (source) => {
      await dispatch('addCard', { problem: buildProblem() });
      const before = await exported();
      const config = await dispatch('getGistSyncConfig');
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
      expect(await exported()).toEqual(before);
      expect(await dispatch('getGistSyncConfig')).toEqual(config);
      expect(await dispatch('getGistSyncStatus')).toMatchObject({ lastSyncTime: null, lastSyncDirection: null });
      await dispatch('saveNote', { slug: 'two-sum', text: 'After failure' });
      expect(await dispatch('getNote', { slug: 'two-sum' })).toBe('After failure');
    }
  );

  it.each(['file', 'gist'] as const)(
    'rejects future %s data before overwriting either side, even when local data is newer',
    async (source) => {
      await dispatch('addCard', { problem: buildProblem() });
      const before = await exported();
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
      expect(await exported()).toEqual(before);
      expect(writes).not.toHaveBeenCalled();
      expect(github.update).not.toHaveBeenCalled();
    }
  );

  it.each(['success', 'failure'] as const)(
    'holds alarm network work in the shared queue through %s while reads overlap',
    async (outcome) => {
      const alarmRegistration = vi.spyOn(browser.alarms.onAlarm, 'addListener');
      vi.mocked(onMessage).mockClear();
      background.main();
      await dispatch('getSettings');
      const alarm = alarmRegistration.mock.calls[0][0];
      const started = Promise.withResolvers<void>();
      const release = Promise.withResolvers<void>();
      github.get.mockImplementationOnce(async () => {
        started.resolve();
        await release.promise;
        if (outcome === 'failure') throw new Error('Network failed');
        return { data: { files: {} } };
      });
      const before = await exported();
      const syncing = alarm({
        name: 'gist-sync',
        scheduledTime: Date.now(),
        periodInMinutes: 1,
        persistAcrossSessions: true,
      });
      await started.promise;
      const writing = dispatch('addCard', { problem: buildProblem() });
      expect(await exported()).toEqual(before);
      expect(await dispatch('getGistSyncStatus')).toMatchObject({ syncInProgress: true });
      release.resolve();
      await Promise.all([syncing, writing]);
      expect(await dispatch('getAllCards')).toMatchObject([buildProblem()]);
      if (outcome === 'success') {
        expect(JSON.parse(github.update.mock.calls[0][0].files['leetsrs-backup.json'].content)).toEqual(before);
      } else {
        expect(github.update).not.toHaveBeenCalled();
        expect(await dispatch('getGistSyncStatus')).toMatchObject({ lastError: 'Network failed' });
      }
      await dispatch('resetAllData');
      expect(await dispatch('getGistSyncStatus')).toEqual({
        lastSyncTime: null,
        lastSyncDirection: null,
        syncInProgress: false,
        lastError: null,
      });
    }
  );

  it.each([
    { enabled: false, pat: 'secret', gistId: 'gist' },
    { enabled: true, pat: '', gistId: 'gist' },
    { enabled: true, pat: 'secret', gistId: null },
  ])('skips automatic sync when its connection is incomplete: %j', async (config) => {
    await dispatch('setGistSyncConfig', { config });
    const registration = vi.spyOn(browser.alarms.onAlarm, 'addListener');
    background.main();
    const alarm = registration.mock.calls[0][0];
    await alarm({ name: 'gist-sync', scheduledTime: Date.now(), periodInMinutes: 1, persistAcrossSessions: true });
    expect(github.get).not.toHaveBeenCalled();
  });

  it('creates a Gist from the document without treating connection changes as learning edits', async () => {
    await dispatch('updateSettings', { changes: { language: 'de' } });
    const before = await exported();
    github.create.mockResolvedValueOnce({ data: { id: 'created-gist' } });
    await expect(dispatch('createNewGist')).resolves.toEqual({ gistId: 'created-gist' });
    expect(JSON.parse(github.create.mock.calls[0][0].files['leetsrs-backup.json'].content)).toEqual(before);
    expect(await dispatch('getGistSyncConfig')).toEqual({ pat: 'secret', gistId: 'created-gist', enabled: true });
    await dispatch('setGistSyncConfig', { config: { enabled: false } });
    expect(await exported()).toEqual(before);
    expect(await fakeBrowser.storage.local.get('leetsrs:dataUpdatedAt')).toEqual({});
  });
});
