import type { MaybePromise } from '@webext-core/messaging';
import type { MessageData, MessageName, MessageResult } from '@/shared/messages';

type BackgroundMessage<Name extends MessageName> = {
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
