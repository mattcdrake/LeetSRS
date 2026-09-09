import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fakeBrowser } from 'wxt/testing/fake-browser';
import { storage } from 'wxt/utils/storage';
import { ZodError } from 'zod';
import { type MessageData, type MessageName, onMessage } from '@/infrastructure/browser/messages';
import { createNewGist, getGistSyncConfig, setGistSyncConfig, validateGistId } from '@/services/gist-setup';
import { validatePat } from '@/services/github-auth';
import { getGistSyncStatus, triggerGistSync } from '@/services/github-sync';
import { buildProblem } from '@/test/utils/card-mocks';
import { createDeferred } from '@/test/utils/deferred';
import { messages, registerBackgroundMessages } from '../message-handlers';
import type { BackgroundMessageRegistry } from '../message-runner';

vi.mock('@/infrastructure/browser/messages', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/infrastructure/browser/messages')>()),
  onMessage: vi.fn(),
}));
vi.mock('@/services/gist-setup', () => ({
  createNewGist: vi.fn(),
  getGistSyncConfig: vi.fn(),
  setGistSyncConfig: vi.fn(),
  validateGistId: vi.fn(),
}));
vi.mock('@/services/github-auth', () => ({ validatePat: vi.fn() }));
vi.mock('@/services/github-sync', () => ({ getGistSyncStatus: vi.fn(), triggerGistSync: vi.fn() }));

describe('GitHub message contracts', () => {
  it('returns combined configuration and forwards partial updates unchanged', async () => {
    const config = { pat: ' token ', gistId: 'gist', enabled: false };
    vi.mocked(getGistSyncConfig).mockResolvedValue(config);
    expect(await messages.getGistSyncConfig.handler()).toEqual(config);

    await messages.setGistSyncConfig.handler({ config: { gistId: null } });
    expect(setGistSyncConfig).toHaveBeenCalledExactlyOnceWith({ gistId: null });
  });

  it.each([
    {
      name: 'PAT',
      service: vi.mocked(validatePat),
      invoke: () => messages.validatePat.handler({ pat: ' token ' }),
      args: [' token '],
      result: { valid: true, username: 'user' },
    },
    {
      name: 'Gist',
      service: vi.mocked(validateGistId),
      invoke: () => messages.validateGistId.handler({ gistId: ' gist ', pat: ' supplied ' }),
      args: [' gist ', ' supplied '],
      result: { valid: false, error: 'Gist not found' },
    },
  ])('forwards $name validation inputs and results unchanged', async ({ service, invoke, args, result }) => {
    service.mockResolvedValue(result);
    expect(await invoke()).toEqual(result);
    expect(service).toHaveBeenCalledExactlyOnceWith(...args);
  });

  it('returns creation results and failures without marking local edits or refreshing the badge', async () => {
    const markDataUpdated = vi.fn();
    const refreshBadge = vi.fn();
    const runner = registerBackgroundMessages(messages, {
      ready: Promise.resolve(),
      markDataUpdated,
      refreshBadge,
    });
    vi.mocked(createNewGist).mockResolvedValueOnce({ gistId: 'created' });
    expect(await runner.execute(messages.createNewGist, undefined)).toEqual({ gistId: 'created' });
    expect(createNewGist).toHaveBeenCalledExactlyOnceWith(undefined);

    const failure = new Error('save failed');
    vi.mocked(createNewGist).mockRejectedValueOnce(failure);
    await expect(runner.execute(messages.createNewGist, undefined)).rejects.toBe(failure);
    expect(markDataUpdated).not.toHaveBeenCalled();
    expect(refreshBadge).not.toHaveBeenCalled();
  });

  it('returns sync status and preserves sync results through the write runner', async () => {
    const status = {
      lastSyncTime: null,
      lastSyncDirection: null,
      syncInProgress: false,
      lastError: 'previous failure',
    };
    vi.mocked(getGistSyncStatus).mockResolvedValue(status);
    expect(await messages.getGistSyncStatus.handler()).toEqual(status);

    vi.mocked(triggerGistSync).mockResolvedValue({ success: false, error: 'Gist not found' });
    const markDataUpdated = vi.fn();
    const refreshBadge = vi.fn();
    const runner = registerBackgroundMessages(messages, {
      ready: Promise.resolve(),
      markDataUpdated,
      refreshBadge,
    });
    expect(await runner.execute(messages.triggerGistSync, undefined)).toEqual({
      success: false,
      error: 'Gist not found',
    });
    expect(triggerGistSync).toHaveBeenCalledExactlyOnceWith(undefined);
    expect(markDataUpdated).not.toHaveBeenCalled();
    expect(refreshBadge).toHaveBeenCalledOnce();
  });
});

describe('background message registration', () => {
  it('registers every handler synchronously and shares its queue with direct execution', async () => {
    const ready = createDeferred<void>();
    const started = createDeferred<void>();
    const release = createDeferred<void>();
    const events: string[] = [];
    const handler = vi.fn(async ({ cardId }: { cardId: string }) => {
      events.push(cardId);
      started.resolve();
      await release.promise;
    });
    const registry = {
      ...messages,
      deleteNote: { ...messages.deleteNote, handler },
    } satisfies BackgroundMessageRegistry;
    const runner = registerBackgroundMessages(registry, {
      ready: ready.promise,
      markDataUpdated: async () => {
        events.push('mark');
      },
      refreshBadge: async () => {},
    });

    const registrations = vi.mocked(onMessage).mock.calls;
    expect(registrations.map(([name]) => name).sort()).toEqual(Object.keys(messages).sort());
    const listener = registrations.find(([name]) => name === 'deleteNote')?.[1];
    expect(listener).toBeDefined();
    if (!listener) throw new Error('deleteNote listener was not registered');

    const pendingMessage = listener({
      id: 1,
      type: 'deleteNote',
      data: { cardId: 'message' },
      timestamp: 0,
      sender: {},
    });
    const pendingDirect = runner.execute(registry.deleteNote, { cardId: 'direct' });
    expect(handler).not.toHaveBeenCalled();

    ready.resolve();
    await started.promise;
    expect(events).toEqual(['message']);

    release.resolve();
    await Promise.all([pendingMessage, pendingDirect]);
    expect(events).toEqual(['message', 'mark', 'direct', 'mark']);
  });
});

const problem = buildProblem();
const payloadCases: [MessageName, Record<string, unknown>, unknown[]][] = [
  [
    'addCard',
    { problem },
    [
      { problem: null },
      { problem: { ...problem, slug: '' } },
      { problem: { ...problem, difficulty: 'Impossible' } },
      { problem: { ...problem, domain: 'example.com' } },
    ],
  ],
  ['removeCard', { slug: problem.slug }, [{ slug: '' }, { slug: 42 }]],
  [
    'delayCard',
    { slug: problem.slug, days: 1 },
    [
      { slug: problem.slug, days: -1 },
      { slug: problem.slug, days: 0.5 },
      { slug: problem.slug, days: '1' },
      { slug: problem.slug, days: Infinity },
    ],
  ],
  ['setPauseStatus', { slug: problem.slug, paused: false }, [{ slug: problem.slug, paused: 'false' }]],
  [
    'rateCard',
    { input: { ...problem, rating: 4 } },
    [
      { input: { ...problem, rating: 0 } },
      { input: { ...problem, rating: 5 } },
      { input: { ...problem, rating: '3' } },
      { input: { ...problem, rating: 2.5 } },
    ],
  ],
  ['getNote', { cardId: 'card' }, [{ cardId: '' }, { cardId: null }]],
  [
    'saveNote',
    { cardId: 'card', text: 'a'.repeat(500) },
    [
      { cardId: 'card', text: 'a'.repeat(501) },
      { cardId: 'card', text: 42 },
      { cardId: ' ', text: '' },
    ],
  ],
  ['deleteNote', { cardId: 'card' }, [{ cardId: '' }, { cardId: 42 }]],
  [
    'updateSettings',
    { changes: { theme: 'dark', badgeEnabled: false } },
    [{ changes: null }, { changes: [] }, { changes: { language: 'constructor' } }, { changes: { dayStartHour: 24 } }],
  ],
  [
    'shouldResetEditor',
    { slug: problem.slug, domain: 'leetcode.cn' },
    [
      { slug: problem.slug, domain: 'example.com' },
      { slug: '', domain: 'leetcode.com' },
    ],
  ],
  ['getLastNDaysStats', { days: 0 }, [{ days: -1 }, { days: 0.5 }, { days: '30' }, { days: NaN }]],
  ['getNextNDaysStats', { days: 14 }, [{ days: -1 }, { days: 0.5 }, { days: '14' }, { days: Infinity }]],
  ['importData', { jsonData: '{}' }, [{ jsonData: {} }, { jsonData: null }]],
  [
    'setGistSyncConfig',
    { config: { gistId: null, pat: '', enabled: false } },
    [
      { config: null },
      { config: [] },
      { config: { gistId: 42 } },
      { config: { pat: null } },
      { config: { enabled: 'false' } },
    ],
  ],
  ['validatePat', { pat: '' }, [{ pat: null }, { pat: 42 }]],
  [
    'validateGistId',
    { gistId: '', pat: ' token ' },
    [
      { gistId: null, pat: 'token' },
      { gistId: 'gist', pat: 42 },
    ],
  ],
];

// Deliberately bypass the sender's TypeScript contract to exercise untrusted RPC input.
function dispatchRaw(name: MessageName, data: unknown) {
  const listener = vi.mocked(onMessage).mock.calls.find(([registered]) => registered === name)?.[1];
  if (!listener) throw new Error(`Missing listener for ${name}`);
  return listener({ id: 1, type: name, data: data as MessageData<MessageName>, timestamp: 0, sender: {} });
}

describe('background payload validation', () => {
  beforeEach(() => {
    fakeBrowser.reset();
    fakeBrowser.runtime.id = 'test';
  });

  it.each(
    payloadCases.flatMap(([name, _valid, invalid]) =>
      [undefined, null, [], {}, ...invalid].map((data): [MessageName, unknown] => [name, data])
    )
  )('rejects %s payload %j before handlers or effects', async (name, data) => {
    const handler = vi.spyOn(messages[name], 'handler');
    const writes = vi.spyOn(storage, 'setItem');
    const removals = vi.spyOn(storage, 'removeItem');
    const markDataUpdated = vi.fn();
    const refreshBadge = vi.fn();
    registerBackgroundMessages(messages, { ready: Promise.resolve(), markDataUpdated, refreshBadge });
    const before = await fakeBrowser.storage.local.get(null);

    await expect(dispatchRaw(name, data)).rejects.toBeInstanceOf(ZodError);
    expect(handler).not.toHaveBeenCalled();
    expect(writes).not.toHaveBeenCalled();
    expect(removals).not.toHaveBeenCalled();
    expect(markDataUpdated).not.toHaveBeenCalled();
    expect(refreshBadge).not.toHaveBeenCalled();
    expect(await fakeBrowser.storage.local.get(null)).toEqual(before);
  });

  it.each(payloadCases)('forwards valid %s payloads after stripping unknown envelope fields', async (name, data) => {
    const handler = vi.spyOn(messages[name], 'handler').mockResolvedValue(undefined);
    registerBackgroundMessages(messages, {
      ready: Promise.resolve(),
      markDataUpdated: vi.fn(),
      refreshBadge: vi.fn(),
    });
    await dispatchRaw(name, { ...data, extra: true });
    expect(handler).toHaveBeenCalledExactlyOnceWith(data);
  });

  it.each([
    ['addCard', { problem: { ...problem, extra: true } }, { problem }],
    ['rateCard', { input: { ...problem, rating: 1, extra: true } }, { input: { ...problem, rating: 1 } }],
    [
      'updateSettings',
      {
        changes: Object.assign(Object.create({ badgeEnabled: false }), {
          theme: undefined,
          dayStartHour: 4,
          extra: true,
        }),
      },
      { changes: { dayStartHour: 4 } },
    ],
    ['setGistSyncConfig', { config: { extra: true } }, { config: {} }],
  ] satisfies [MessageName, unknown, unknown][])('strips unknown nested %s fields', async (name, data, expected) => {
    const handler = vi.spyOn(messages[name], 'handler').mockResolvedValue(undefined);
    registerBackgroundMessages(messages, { ready: Promise.resolve(), markDataUpdated: vi.fn(), refreshBadge: vi.fn() });
    await dispatchRaw(name, data);
    expect(handler).toHaveBeenCalledExactlyOnceWith(expected);
  });
});
