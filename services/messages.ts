import { browser } from 'wxt/browser';
import type { Card } from './cards';
import type { Grade } from 'ts-fsrs';
import type { DailyStats } from './stats';

// Message type constants
export const MessageType = {
  ADD_CARD: 'ADD_CARD',
  GET_ALL_CARDS: 'GET_ALL_CARDS',
  REMOVE_CARD: 'REMOVE_CARD',
  RATE_CARD: 'RATE_CARD',
  GET_REVIEW_QUEUE: 'GET_REVIEW_QUEUE',
  GET_TODAY_STATS: 'GET_TODAY_STATS',
} as const;

// Message request types as discriminated union
export type MessageRequest =
  | { type: typeof MessageType.ADD_CARD; slug: string; name: string }
  | { type: typeof MessageType.GET_ALL_CARDS }
  | { type: typeof MessageType.REMOVE_CARD; slug: string }
  | { type: typeof MessageType.RATE_CARD; slug: string; rating: Grade }
  | { type: typeof MessageType.GET_REVIEW_QUEUE }
  | { type: typeof MessageType.GET_TODAY_STATS };

// Type mapping for request to response
export type MessageResponseMap = {
  [MessageType.ADD_CARD]: Card;
  [MessageType.GET_ALL_CARDS]: Card[];
  [MessageType.REMOVE_CARD]: void;
  [MessageType.RATE_CARD]: Card;
  [MessageType.GET_REVIEW_QUEUE]: Card[];
  [MessageType.GET_TODAY_STATS]: DailyStats | null;
};

/**
 * Type-safe wrapper for sending messages to the background script
 */
export async function sendMessage<T extends MessageRequest>(message: T): Promise<MessageResponseMap[T['type']]> {
  return browser.runtime.sendMessage(message);
}
