import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { fakeBrowser } from 'wxt/testing/fake-browser';
import { onMessage } from '@/infrastructure/browser/messages';
import { readLearningDocument } from '@/infrastructure/storage/learning-document';
import { dispatchBackgroundCommand as dispatch } from '@/test/utils/background-messages';
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

beforeEach(async () => {
  fakeBrowser.reset();
  fakeBrowser.runtime.id = 'test';
  vi.mocked(onMessage).mockClear();
  background.main();
  await dispatch('waitForInitialization');
  await dispatch('resetAllData');
  github.get.mockResolvedValue({ data: { files: {} } });
  github.update.mockResolvedValue({});
  await fakeBrowser.storage.sync.set({ 'leetsrs:gistConnection': { pat: 'secret', gistId: 'gist', enabled: true } });
});
afterEach(() => vi.useRealTimers());

function pauseRequest(request: typeof github.get) {
  const started = Promise.withResolvers<void>();
  const response = Promise.withResolvers<unknown>();
  request.mockImplementationOnce(() => {
    started.resolve();
    return response.promise;
  });
  return { ...response, started: started.promise };
}

it('responds to local saves during slow GitHub work and uploads the current document', async () => {
  const download = pauseRequest(github.get);
  const sync = dispatch('triggerGistSync');
  await download.started;
  try {
    await dispatch('addCard', { problem: buildProblem() });
    await dispatch('saveNote', { slug: 'two-sum', text: 'Saved while offline' });
    expect((await readLearningDocument()).cards['two-sum'].note).toBe('Saved while offline');
  } finally {
    download.resolve({ data: { files: {} } });
  }
  await sync;
  expect(JSON.parse(github.update.mock.calls[0][0].files['leetsrs-backup.json'].content).cards['two-sum'].note).toBe(
    'Saved while offline'
  );
});

it('starts sync after a save, shares duplicate triggers, and coalesces intervening saves into one follow-up', async () => {
  const upload = pauseRequest(github.update);
  await dispatch('addCard', { problem: buildProblem() });
  await upload.started;
  const duplicate = dispatch('triggerGistSync');
  await dispatch('saveNote', { slug: 'two-sum', text: 'first draft' });
  await dispatch('saveNote', { slug: 'two-sum', text: 'latest draft' });
  expect(github.get).toHaveBeenCalledTimes(1);
  upload.resolve(undefined);
  await duplicate;
  await vi.waitFor(() => expect(github.update).toHaveBeenCalledTimes(2));
  await vi.waitFor(async () => expect(await dispatch('getGistSyncStatus')).toMatchObject({ syncInProgress: false }));
  expect(github.get).toHaveBeenCalledTimes(2);
  expect(JSON.parse(github.update.mock.calls[1][0].files['leetsrs-backup.json'].content).cards['two-sum'].note).toBe(
    'latest draft'
  );
});

it.each(['import', 'reset', 'connection'] as const)(
  'ignores a late download after %s and allows another attempt',
  async (operation) => {
    const download = pauseRequest(github.get);
    const sync = dispatch('triggerGistSync');
    await download.started;
    if (operation === 'import') {
      await dispatch('importData', {
        jsonData: JSON.stringify({ schemaVersion: 6, cards: {}, stats: {}, settings: { theme: 'dark' } }),
      });
    } else if (operation === 'reset') {
      await dispatch('resetAllData');
    } else {
      await dispatch('setGistSyncEnabled', { enabled: false });
    }
    const before = await readLearningDocument();
    const writes = vi.spyOn(fakeBrowser.storage.local, 'set');
    download.resolve({
      data: {
        files: {
          'leetsrs-backup.json': {
            content: JSON.stringify({ ...before, settings: { theme: 'light' }, dataUpdatedAt: '2099-01-01' }),
          },
        },
      },
    });
    expect(await sync).toMatchObject({ success: false });
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(await readLearningDocument()).toEqual(before);
    expect(writes).not.toHaveBeenCalled();
    expect(github.update).not.toHaveBeenCalled();
    if (operation !== 'reset') expect(await dispatch('triggerGistSync')).toMatchObject({ success: true });
  }
);

it.each(['success', 'offline', 'timeout'] as const)(
  'releases arrival edits after %s and ignores late responses',
  async (outcome) => {
    vi.useFakeTimers();
    const download = pauseRequest(github.get);
    const arrival = dispatch('refreshGistOnArrival');
    await download.started;
    const saved = vi.fn();
    const edit = dispatch('addCard', { problem: buildProblem() }).then(saved);
    await vi.advanceTimersByTimeAsync(2999);
    expect(saved).not.toHaveBeenCalled();
    expect((await readLearningDocument()).cards).toEqual({});
    if (outcome === 'success') download.resolve({ data: { files: {} } });
    else if (outcome === 'offline') download.reject(new TypeError('Failed to fetch'));
    else await vi.advanceTimersByTimeAsync(1);
    const result = await arrival;
    if (outcome !== 'success')
      expect(result).toMatchObject({ success: false, error: expect.stringContaining('continue learning') });
    await edit;
    expect(saved).toHaveBeenCalledOnce();
    await vi.advanceTimersByTimeAsync(0);
    const before = await readLearningDocument();
    const writes = vi.spyOn(fakeBrowser.storage.local, 'set');
    if (outcome === 'timeout') {
      download.resolve({ data: { files: {} } });
      await vi.advanceTimersByTimeAsync(0);
      expect(writes).not.toHaveBeenCalled();
      expect(await readLearningDocument()).toEqual(before);
    }
  }
);

it('does not sync no-op or rejected saves and retries an offline save through the minute alarm', async () => {
  await dispatch('setGistSyncEnabled', { enabled: false });
  await dispatch('addCard', { problem: buildProblem() });
  await fakeBrowser.storage.sync.set({ 'leetsrs:gistConnection': { pat: 'secret', gistId: 'gist', enabled: true } });
  await dispatch('addCard', { problem: buildProblem() });
  await dispatch('deleteNote', { slug: 'two-sum' });
  await dispatch('updateSettings', { changes: {} });
  await expect(dispatch('rateCard', { input: { ...buildProblem(), rating: 0 } })).rejects.toThrow();
  vi.spyOn(fakeBrowser.storage.local, 'set').mockRejectedValueOnce(new Error('disk unavailable'));
  await expect(dispatch('saveNote', { slug: 'two-sum', text: 'failed' })).rejects.toThrow('disk unavailable');
  expect(github.get).not.toHaveBeenCalled();
  github.get.mockRejectedValueOnce(new TypeError('Failed to fetch'));
  await dispatch('saveNote', { slug: 'two-sum', text: 'saved offline' });
  await vi.waitFor(async () =>
    expect(await dispatch('getGistSyncStatus')).toMatchObject({
      lastError: expect.stringContaining('continue learning'),
      syncInProgress: false,
    })
  );
  expect((await readLearningDocument()).cards['two-sum'].note).toBe('saved offline');
  await fakeBrowser.alarms.onAlarm.trigger({
    name: 'gist-sync',
    scheduledTime: Date.now(),
    periodInMinutes: 1,
    persistAcrossSessions: true,
  });
  await vi.waitFor(async () =>
    expect(await dispatch('getGistSyncStatus')).toMatchObject({ lastError: null, syncInProgress: false })
  );
  expect(JSON.parse(github.update.mock.calls[0][0].files['leetsrs-backup.json'].content).cards['two-sum'].note).toBe(
    'saved offline'
  );
});

it('skips automatic arrival, save and alarm triggers while disabled but allows manual sync', async () => {
  await dispatch('setGistSyncEnabled', { enabled: false });
  await dispatch('refreshGistOnArrival');
  await dispatch('addCard', { problem: buildProblem() });
  await fakeBrowser.alarms.onAlarm.trigger({
    name: 'gist-sync',
    scheduledTime: Date.now(),
    periodInMinutes: 1,
    persistAcrossSessions: true,
  });
  expect(github.get).not.toHaveBeenCalled();
  expect(await dispatch('triggerGistSync')).toMatchObject({ success: true });
  expect(github.get).toHaveBeenCalledTimes(1);
});

it.each(['resolve', 'reject'] as const)(
  'ignores late upload %s after timeout without altering newer sync status',
  async (outcome) => {
    vi.useFakeTimers();
    const upload = pauseRequest(github.update);
    const sync = dispatch('triggerGistSync');
    await upload.started;
    const arrival = dispatch('refreshGistOnArrival');
    await vi.advanceTimersByTimeAsync(3000);
    expect(await arrival).toMatchObject({ success: false });
    expect(await sync).toMatchObject({ success: false });
    expect(await dispatch('triggerGistSync')).toMatchObject({ success: true });
    const status = await dispatch('getGistSyncStatus');
    const writes = vi.spyOn(fakeBrowser.storage.local, 'set');
    if (outcome === 'resolve') upload.resolve(undefined);
    else upload.reject(new Error('late failure'));
    await vi.advanceTimersByTimeAsync(0);
    expect(writes).not.toHaveBeenCalled();
    expect(await dispatch('getGistSyncStatus')).toEqual(status);
  }
);

it('leaves the timestamp untouched and requests no sync for unchanged local values', async () => {
  await dispatch('setGistSyncEnabled', { enabled: false });
  await dispatch('addCard', { problem: buildProblem() });
  await dispatch('saveNote', { slug: 'two-sum', text: 'same note' });
  await dispatch('updateSettings', { changes: { theme: 'dark' } });
  await fakeBrowser.storage.sync.set({ 'leetsrs:gistConnection': { pat: 'secret', gistId: 'gist', enabled: true } });
  const before = await readLearningDocument();
  const writes = vi.spyOn(fakeBrowser.storage.local, 'set');
  await dispatch('saveNote', { slug: 'two-sum', text: 'same note' });
  await dispatch('setPauseStatus', { slug: 'two-sum', paused: false });
  await dispatch('delayCard', { slug: 'two-sum', days: 0 });
  await dispatch('removeCard', { slug: 'missing' });
  await dispatch('updateSettings', { changes: { theme: 'dark' } });
  expect(await readLearningDocument()).toEqual(before);
  expect(writes).not.toHaveBeenCalled();
  expect(github.get).not.toHaveBeenCalled();
});

it.each(['existing', 'create'] as const)(
  'does not restore a connection when %s setup finishes after reset',
  async (mode) => {
    const response = pauseRequest(mode === 'create' ? github.create : github.get);
    const setup = dispatch('setupGistSync', { mode, pat: 'new-token', gistId: 'new-gist' });
    await response.started;
    await dispatch('resetAllData');
    response.resolve({ data: { id: 'created-gist', files: { 'leetsrs-backup.json': {} } } });
    expect(await setup).toMatchObject({ saved: false });
    expect(await fakeBrowser.storage.sync.get(null)).toEqual({});
    expect(await dispatch('getGistSyncStatus')).toMatchObject({ lastSyncTime: null, lastError: null });
  }
);

it('uses the selected language for temporary sync failures', async () => {
  await dispatch('setGistSyncEnabled', { enabled: false });
  await dispatch('updateSettings', { changes: { language: 'de' } });
  await fakeBrowser.storage.sync.set({ 'leetsrs:gistConnection': { pat: 'secret', gistId: 'gist', enabled: true } });
  github.get.mockRejectedValueOnce(new TypeError('Failed to fetch'));
  expect(await dispatch('refreshGistOnArrival')).toEqual({
    success: false,
    error: 'Du kannst weiterlernen. Die Synchronisierung wird automatisch fortgesetzt, sobald GitHub verfügbar ist.',
  });
});

it.each(['reset', 'connection'] as const)(
  'does not restore stale credentials when a toggle overlaps %s',
  async (change) => {
    const previous = await fakeBrowser.storage.sync.get(null);
    const connection = Promise.withResolvers<Record<string, unknown>>();
    const started = Promise.withResolvers<void>();
    vi.spyOn(fakeBrowser.storage.sync, 'get').mockImplementationOnce(() => {
      started.resolve();
      return connection.promise;
    });
    const toggle = dispatch('setGistSyncEnabled', { enabled: false });
    await started.promise;
    if (change === 'reset') await dispatch('resetAllData');
    else await fakeBrowser.storage.sync.set({ 'leetsrs:gistConnection': { pat: 'new', gistId: 'new', enabled: true } });
    const current = await fakeBrowser.storage.sync.get(null);
    connection.resolve(previous);
    expect(await toggle).toMatchObject({ saved: false });
    expect(await fakeBrowser.storage.sync.get(null)).toEqual(current);
    expect(github.get).not.toHaveBeenCalled();
  }
);

it('retains a save follow-up when arrival times out an existing upload', async () => {
  vi.useFakeTimers();
  const upload = pauseRequest(github.update);
  await dispatch('addCard', { problem: buildProblem() });
  await upload.started;
  await dispatch('saveNote', { slug: 'two-sum', text: 'follow up after timeout' });
  const arrival = dispatch('refreshGistOnArrival');
  await vi.advanceTimersByTimeAsync(3000);
  expect(await arrival).toMatchObject({ success: false });
  await vi.advanceTimersByTimeAsync(0);
  expect(github.update).toHaveBeenCalledTimes(2);
  expect(JSON.parse(github.update.mock.calls[1][0].files['leetsrs-backup.json'].content).cards['two-sum'].note).toBe(
    'follow up after timeout'
  );
  upload.resolve(undefined);
  await vi.advanceTimersByTimeAsync(0);
});

it('does not hold arrival edits behind a manual sync when automatic sync is disabled', async () => {
  await dispatch('setGistSyncEnabled', { enabled: false });
  const download = Promise.withResolvers<{ data: { files: Record<string, never> } }>();
  const started = Promise.withResolvers<void>();
  github.get.mockImplementationOnce(() => {
    started.resolve();
    return download.promise;
  });
  const manual = dispatch('triggerGistSync');
  await started.promise;
  try {
    expect(await dispatch('refreshGistOnArrival')).toBeUndefined();
    await dispatch('addCard', { problem: buildProblem() });
    expect((await readLearningDocument()).cards['two-sum']).toMatchObject(buildProblem());
  } finally {
    download.resolve({ data: { files: {} } });
  }
  await manual;
  expect(github.get).toHaveBeenCalledTimes(1);
});

it('releases arrival edits at the deadline even while connection storage is pending', async () => {
  vi.useFakeTimers();
  const connection = Promise.withResolvers<Record<string, unknown>>();
  vi.spyOn(fakeBrowser.storage.sync, 'get').mockImplementationOnce(async () => connection.promise);
  const arrival = dispatch('refreshGistOnArrival');
  await vi.advanceTimersByTimeAsync(3000);
  expect(await arrival).toMatchObject({ success: false });
  await dispatch('addCard', { problem: buildProblem() });
  connection.resolve({ 'leetsrs:gistConnection': { pat: 'obsolete', gistId: 'obsolete', enabled: true } });
  await vi.advanceTimersByTimeAsync(0);
  expect(github.get.mock.calls.some(([args]) => args.gist_id === 'obsolete')).toBe(false);
});
