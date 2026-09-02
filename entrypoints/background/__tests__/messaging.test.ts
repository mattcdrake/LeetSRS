import { describe, expect, it, vi } from 'vitest';
import type { BackgroundMessageRegistry } from '@/shared/messages';
import { createDeferred } from '@/test/utils/deferred';
import { createBackgroundMessageExecutor } from '../messaging';

describe('background message executor', () => {
  it('waits for readiness and lets reads bypass queued writes', async () => {
    const ready = createDeferred<void>();
    const releaseWrite = createDeferred<void>();
    const writeStarted = createDeferred<void>();
    const markDataUpdated = vi.fn(async () => {});
    const refreshBadge = vi.fn(async () => {});
    const executor = createBackgroundMessageExecutor({
      ready: ready.promise,
      markDataUpdated,
      refreshBadge,
    });
    const readHandler = vi.fn(() => 'PONG' as const);
    const read = {
      kind: 'read',
      handler: readHandler,
    } satisfies BackgroundMessageRegistry['ping'];
    const write = {
      kind: 'write',
      syncTrackingOwner: 'handler',
      refreshBadge: false,
      handler: async (_data: { cardId: string }) => {
        writeStarted.resolve();
        await releaseWrite.promise;
      },
    } satisfies BackgroundMessageRegistry['deleteNote'];

    const pendingWrite = executor.execute(write, { cardId: 'one' });
    const pendingRead = executor.execute(read, undefined);
    expect(readHandler).not.toHaveBeenCalled();

    ready.resolve();
    await writeStarted.promise;
    await expect(pendingRead).resolves.toBe('PONG');
    expect(readHandler).toHaveBeenCalledOnce();

    releaseWrite.resolve();
    await pendingWrite;
    expect(markDataUpdated).not.toHaveBeenCalled();
    expect(refreshBadge).not.toHaveBeenCalled();
  });

  it('runs writes in order and applies their declared effects', async () => {
    const releaseFirst = createDeferred<void>();
    const firstStarted = createDeferred<void>();
    const events: string[] = [];
    const executor = createBackgroundMessageExecutor({
      ready: Promise.resolve(),
      markDataUpdated: async () => {
        events.push('mark');
      },
      refreshBadge: async () => {
        events.push('badge');
      },
    });
    const write = {
      kind: 'write',
      syncTrackingOwner: 'executor',
      refreshBadge: true,
      handler: async ({ cardId }: { cardId: string }) => {
        events.push(`${cardId}:start`);
        if (cardId === 'first') {
          firstStarted.resolve();
          await releaseFirst.promise;
        }
        events.push(`${cardId}:end`);
      },
    } satisfies BackgroundMessageRegistry['deleteNote'];

    const first = executor.execute(write, { cardId: 'first' });
    const second = executor.execute(write, { cardId: 'second' });
    await firstStarted.promise;
    expect(events).toEqual(['first:start']);

    releaseFirst.resolve();
    await Promise.all([first, second]);
    expect(events).toEqual([
      'first:start',
      'first:end',
      'mark',
      'badge',
      'second:start',
      'second:end',
      'mark',
      'badge',
    ]);
  });

  it('skips effects after handler failure and continues the queue', async () => {
    const markDataUpdated = vi.fn(async () => {});
    const refreshBadge = vi.fn(async () => {});
    const executor = createBackgroundMessageExecutor({
      ready: Promise.resolve(),
      markDataUpdated,
      refreshBadge,
    });
    const failure = new Error('write failed');
    const failingWrite = {
      kind: 'write',
      syncTrackingOwner: 'executor',
      refreshBadge: true,
      handler: async () => {
        throw failure;
      },
    } satisfies BackgroundMessageRegistry['resetAllData'];
    const nextHandler = vi.fn(async () => {});
    const nextWrite = {
      kind: 'write',
      syncTrackingOwner: 'none',
      refreshBadge: false,
      handler: nextHandler,
    } satisfies BackgroundMessageRegistry['resetAllData'];

    await expect(executor.execute(failingWrite, undefined)).rejects.toBe(failure);
    expect(markDataUpdated).not.toHaveBeenCalled();
    expect(refreshBadge).not.toHaveBeenCalled();

    await expect(executor.execute(nextWrite, undefined)).resolves.toBeUndefined();
    expect(nextHandler).toHaveBeenCalledOnce();
  });

  it('continues the queue after a side effect fails', async () => {
    const failure = new Error('tracking failed');
    const markDataUpdated = vi.fn().mockRejectedValueOnce(failure).mockResolvedValue(undefined);
    const executor = createBackgroundMessageExecutor({
      ready: Promise.resolve(),
      markDataUpdated,
      refreshBadge: async () => {},
    });
    const handler = vi.fn(async () => {});
    const write = {
      kind: 'write',
      syncTrackingOwner: 'executor',
      refreshBadge: false,
      handler,
    } satisfies BackgroundMessageRegistry['resetAllData'];

    await expect(executor.execute(write, undefined)).rejects.toBe(failure);
    await expect(executor.execute(write, undefined)).resolves.toBeUndefined();
    expect(handler).toHaveBeenCalledTimes(2);
    expect(markDataUpdated).toHaveBeenCalledTimes(2);
  });
});
