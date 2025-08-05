import { browser } from 'wxt/browser';
import type { Card, Difficulty } from '@/shared/cards';
import type { Grade } from 'ts-fsrs';
import type { DailyStats } from './stats';
import type { Note } from '@/shared/notes';

// Message type constants
export const MessageType = {
  ADD_CARD: 'ADD_CARD',
  GET_ALL_CARDS: 'GET_ALL_CARDS',
  REMOVE_CARD: 'REMOVE_CARD',
  DELAY_CARD: 'DELAY_CARD',
  SET_PAUSE_STATUS: 'SET_PAUSE_STATUS',
  RATE_CARD: 'RATE_CARD',
  GET_REVIEW_QUEUE: 'GET_REVIEW_QUEUE',
  GET_TODAY_STATS: 'GET_TODAY_STATS',
  GET_NOTE: 'GET_NOTE',
  SAVE_NOTE: 'SAVE_NOTE',
  DELETE_NOTE: 'DELETE_NOTE',
} as const;

// Message request types as discriminated union
export type MessageRequest =
  | { type: typeof MessageType.ADD_CARD; slug: string; name: string; leetcodeId: string; difficulty: Difficulty }
  | { type: typeof MessageType.GET_ALL_CARDS }
  | { type: typeof MessageType.REMOVE_CARD; slug: string }
  | { type: typeof MessageType.DELAY_CARD; slug: string; days: number }
  | { type: typeof MessageType.SET_PAUSE_STATUS; slug: string; paused: boolean }
  | {
      type: typeof MessageType.RATE_CARD;
      slug: string;
      name: string;
      rating: Grade;
      leetcodeId: string;
      difficulty: Difficulty;
    }
  | { type: typeof MessageType.GET_REVIEW_QUEUE }
  | { type: typeof MessageType.GET_TODAY_STATS }
  | { type: typeof MessageType.GET_NOTE; cardId: string }
  | { type: typeof MessageType.SAVE_NOTE; cardId: string; text: string }
  | { type: typeof MessageType.DELETE_NOTE; cardId: string };

// Type mapping for request to response
export type MessageResponseMap = {
  [MessageType.ADD_CARD]: Card;
  [MessageType.GET_ALL_CARDS]: Card[];
  [MessageType.REMOVE_CARD]: void;
  [MessageType.DELAY_CARD]: Card;
  [MessageType.SET_PAUSE_STATUS]: Card;
  [MessageType.RATE_CARD]: { card: Card; shouldRequeue: boolean };
  [MessageType.GET_REVIEW_QUEUE]: Card[];
  [MessageType.GET_TODAY_STATS]: DailyStats | null;
  [MessageType.GET_NOTE]: Note | null;
  [MessageType.SAVE_NOTE]: void;
  [MessageType.DELETE_NOTE]: void;
};

/**
 * Type-safe wrapper for sending messages to the background script
 */
export async function sendMessage<T extends MessageRequest>(message: T): Promise<MessageResponseMap[T['type']]> {
  return browser.runtime.sendMessage(message);
}
