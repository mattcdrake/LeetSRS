import { browser } from 'wxt/browser';
import type { Card } from './cards';

// Message type constants
export const MessageType = {
  ADD_CARD: 'ADD_CARD',
  GET_ALL_CARDS: 'GET_ALL_CARDS',
  REMOVE_CARD: 'REMOVE_CARD',
} as const;

// Message request types as discriminated union
export type MessageRequest =
  | { type: typeof MessageType.ADD_CARD; slug: string; name: string }
  | { type: typeof MessageType.GET_ALL_CARDS }
  | { type: typeof MessageType.REMOVE_CARD; slug: string };

// Type mapping for request to response
export type MessageResponseMap = {
  [MessageType.ADD_CARD]: Card;
  [MessageType.GET_ALL_CARDS]: Card[];
  [MessageType.REMOVE_CARD]: void;
};

/**
 * Type-safe wrapper for sending messages to the background script
 */
export async function sendMessage<T extends MessageRequest>(message: T): Promise<MessageResponseMap[T['type']]> {
  return browser.runtime.sendMessage(message);
}
