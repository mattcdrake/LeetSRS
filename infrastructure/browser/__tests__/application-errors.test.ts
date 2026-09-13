import { afterEach, expect, it, vi } from 'vitest';
import { ApplicationError, getApplicationFailure } from '@/domain/application-error';
import { safeApplicationError } from '@/infrastructure/application-errors';
import { onMessage, sendMessage } from '../messages';

afterEach(() => vi.unstubAllGlobals());

it('preserves validated error codes through the real messaging serializer without forwarding secrets', async () => {
  let receive: (message: unknown, sender: unknown, respond: (response: unknown) => void) => unknown;
  const wireResponses: unknown[] = [];
  vi.stubGlobal('chrome', {
    runtime: {
      onMessage: {
        addListener: (listener: typeof receive) => {
          receive = listener;
        },
        removeListener: vi.fn(),
      },
      sendMessage: (message: unknown, respond: (response: unknown) => void) =>
        receive(message, {}, (response) => {
          wireResponses.push(JSON.parse(JSON.stringify(response)));
          respond(wireResponses.at(-1));
        }),
    },
  });
  vi.spyOn(console, 'error').mockImplementation(() => {});
  const failure = { code: 'note_too_long', params: { limit: 500 } } as const;
  const unsafe = Object.assign(new ApplicationError(failure), {
    token: 'ghp_secret',
    cause: new Error('private body'),
  });
  const stop = onMessage('saveNote', () => {
    throw safeApplicationError('saveNote', unsafe);
  });
  try {
    const error = await sendMessage('saveNote', { slug: 'two-sum', text: 'x'.repeat(501) }).catch(
      (error: unknown) => error
    );
    expect(error).toBeInstanceOf(Error);
    expect(error).not.toBeInstanceOf(ApplicationError);
    expect(getApplicationFailure(error)).toEqual(failure);
    expect(JSON.stringify(wireResponses)).not.toMatch(/ghp_secret|private body/);
  } finally {
    stop();
  }
});
