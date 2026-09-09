import type { MaybePromise } from '@webext-core/messaging';
import type { z } from 'zod';
import type { MessageData, MessageName, MessageResult } from '@/infrastructure/browser/messages';

type BackgroundMessage<Name extends MessageName> = {
  schema: z.ZodType<MessageData<Name>>;
  handler: (data: MessageData<Name>) => MaybePromise<MessageResult<Name>>;
} & (
  | { kind: 'read' }
  | {
      kind: 'write';
      syncTrackingOwner: 'executor' | 'handler' | 'none';
      refreshBadge: boolean;
    }
);

export type BackgroundMessageRegistry = {
  [Name in MessageName]: BackgroundMessage<Name>;
};

export interface MessageRunnerOptions {
  ready: Promise<void>;
  markDataUpdated(): Promise<void>;
  refreshBadge(): Promise<void>;
}

export function createBackgroundMessageRunner(options: MessageRunnerOptions) {
  // Writes share this promise chain so each one waits for the previous one
  // before touching storage. Reads skip the chain because they do not change
  // data. After a mutation fails, the stored tail is changed back to a resolved
  // promise so the next mutation can still run, while the caller still receives
  // the original error through `result`.
  let writeQueue = Promise.resolve();

  const execute = <Name extends MessageName>(
    message: BackgroundMessageRegistry[Name],
    data: unknown
  ): Promise<MessageResult<Name>> => {
    const run = async () => {
      await options.ready;

      const result = await message.handler(message.schema.parse(data));

      if (message.kind === 'write') {
        if (message.syncTrackingOwner === 'executor') await options.markDataUpdated();
        if (message.refreshBadge) await options.refreshBadge();
      }

      return result;
    };

    if (message.kind === 'read') return run();

    const result = writeQueue.then(run);
    writeQueue = result.then(
      () => undefined,
      () => undefined
    );
    return result;
  };

  return { execute };
}
