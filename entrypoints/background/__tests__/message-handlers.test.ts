import { describe, expect, it, vi } from 'vitest';
import { onMessage } from '@/infrastructure/browser/messages';
import { createDeferred } from '@/test/utils/deferred';
import { messages, registerBackgroundMessages } from '../message-handlers';
import type { BackgroundMessageRegistry } from '../message-runner';

vi.mock('@/infrastructure/browser/messages', () => ({ onMessage: vi.fn() }));

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
