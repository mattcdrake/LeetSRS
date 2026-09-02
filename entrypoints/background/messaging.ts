import {
  type BackgroundMessageRegistry,
  type MessageData,
  type MessageName,
  type MessageResult,
  onMessage,
} from '@/shared/messages';

interface MessageExecutorOptions {
  ready: Promise<void>;
  markDataUpdated(): Promise<void>;
  refreshBadge(): Promise<void>;
}

export function createBackgroundMessageExecutor(options: MessageExecutorOptions) {
  // Mutations share this promise chain so each one waits for the previous one
  // before touching storage. Reads skip the chain because they do not change
  // data. After a mutation fails, the stored tail is changed back to a resolved
  // promise so the next mutation can still run, while the caller still receives
  // the original error through `result`.
  let mutationQueue = Promise.resolve();

  const execute = <Name extends MessageName>(
    message: BackgroundMessageRegistry[Name],
    data: MessageData<Name>
  ): Promise<MessageResult<Name>> => {
    const run = async () => {
      await options.ready;

      const result = await message.handler(data);

      if (message.kind === 'mutation') {
        if (message.markDataUpdated) await options.markDataUpdated();
        if (message.refreshBadge) await options.refreshBadge();
      }

      return result;
    };

    if (message.kind === 'read') return run();

    const result = mutationQueue.then(run);
    mutationQueue = result.then(
      () => undefined,
      () => undefined
    );
    return result;
  };

  return { execute };
}

export function registerBackgroundMessages(registry: BackgroundMessageRegistry, options: MessageExecutorOptions) {
  const executor = createBackgroundMessageExecutor(options);

  const register = <Name extends MessageName>(name: Name) => {
    onMessage(name, ({ data }) => executor.execute(registry[name], data));
  };

  for (const name of Object.keys(registry) as MessageName[]) register(name);

  return executor;
}
