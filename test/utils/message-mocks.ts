import type { GetDataType, GetReturnType, MaybePromise } from '@webext-core/messaging';
import type { MockedFunction } from 'vitest';
import type { ExtensionProtocolMap, sendMessage } from '@/shared/messages';

type MessageName = keyof ExtensionProtocolMap;
type MessageHandler<TName extends MessageName> = (
  data: GetDataType<ExtensionProtocolMap[TName]>
) => MaybePromise<GetReturnType<ExtensionProtocolMap[TName]>>;

/**
 * Configures a mocked `sendMessage` as a typed protocol dispatcher.
 *
 * Call `reset` in `beforeEach`. Every message used by a test must have an
 * explicit handler, so unexpected extension traffic fails the test.
 */
export function createMessageMock(mock: MockedFunction<typeof sendMessage>) {
  const handlers = new Map<MessageName, (data: unknown) => unknown>();

  const install = () => {
    const dispatch = async (type: MessageName, data?: unknown) => {
      const handler = handlers.get(type);
      if (!handler) throw new Error(`Unexpected extension message: ${String(type)}`);
      return handler(data);
    };

    // The library exposes `sendMessage` as generic overloads. The dispatcher
    // enforces each handler's protocol types at registration instead.
    mock.mockImplementation(dispatch as unknown as typeof sendMessage);
  };

  const handle = <TName extends MessageName>(type: TName, handler: MessageHandler<TName>) => {
    handlers.set(type, handler as (data: unknown) => unknown);
    return api;
  };

  const resolve = <TName extends MessageName>(
    type: TName,
    result: MaybePromise<GetReturnType<ExtensionProtocolMap[TName]>>
  ) => handle(type, () => result);

  const reset = () => {
    handlers.clear();
    mock.mockReset();
    install();
    return api;
  };

  const api = { handle, resolve, reset };
  install();
  return api;
}
