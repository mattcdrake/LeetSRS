import { vi } from 'vitest';
import { type MessageData, type MessageName, type MessageResult, onMessage } from '@/infrastructure/browser/messages';

// Accept untrusted payloads so tests exercise validation in the registered dispatcher.
export function dispatchBackgroundCommand<Name extends MessageName>(
  name: Name,
  data?: unknown
): Promise<MessageResult<Name>> {
  const listener = vi.mocked(onMessage).mock.calls.find(([registered]) => registered === name)?.[1];
  if (!listener) {
    throw new Error(`Missing listener for ${name}`);
  }
  return Promise.resolve(
    listener({ id: 1, type: name, data: data as MessageData<MessageName>, timestamp: 0, sender: {} })
  ) as Promise<MessageResult<Name>>;
}
