import { browser } from 'wxt/browser';
import type { Card, Difficulty } from '@/shared/cards';
import type { Grade, State as FsrsState } from 'ts-fsrs';
import type { DailyStats, UpcomingReviewStats } from './stats';
import type { Note } from '@/shared/notes';
import type { Theme } from '@/shared/settings';

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
  GET_MAX_NEW_CARDS_PER_DAY: 'GET_MAX_NEW_CARDS_PER_DAY',
  SET_MAX_NEW_CARDS_PER_DAY: 'SET_MAX_NEW_CARDS_PER_DAY',
  GET_ANIMATIONS_ENABLED: 'GET_ANIMATIONS_ENABLED',
  SET_ANIMATIONS_ENABLED: 'SET_ANIMATIONS_ENABLED',
  GET_THEME: 'GET_THEME',
  SET_THEME: 'SET_THEME',
  GET_CARD_STATE_STATS: 'GET_CARD_STATE_STATS',
  GET_ALL_STATS: 'GET_ALL_STATS',
  GET_LAST_N_DAYS_STATS: 'GET_LAST_N_DAYS_STATS',
  GET_NEXT_N_DAYS_STATS: 'GET_NEXT_N_DAYS_STATS',
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
  | { type: typeof MessageType.DELETE_NOTE; cardId: string }
  | { type: typeof MessageType.GET_MAX_NEW_CARDS_PER_DAY }
  | { type: typeof MessageType.SET_MAX_NEW_CARDS_PER_DAY; value: number }
  | { type: typeof MessageType.GET_ANIMATIONS_ENABLED }
  | { type: typeof MessageType.SET_ANIMATIONS_ENABLED; value: boolean }
  | { type: typeof MessageType.GET_THEME }
  | { type: typeof MessageType.SET_THEME; value: Theme }
  | { type: typeof MessageType.GET_CARD_STATE_STATS }
  | { type: typeof MessageType.GET_ALL_STATS }
  | { type: typeof MessageType.GET_LAST_N_DAYS_STATS; days: number }
  | { type: typeof MessageType.GET_NEXT_N_DAYS_STATS; days: number };

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
  [MessageType.GET_MAX_NEW_CARDS_PER_DAY]: number;
  [MessageType.SET_MAX_NEW_CARDS_PER_DAY]: void;
  [MessageType.GET_ANIMATIONS_ENABLED]: boolean;
  [MessageType.SET_ANIMATIONS_ENABLED]: void;
  [MessageType.GET_THEME]: Theme;
  [MessageType.SET_THEME]: void;
  [MessageType.GET_CARD_STATE_STATS]: Record<FsrsState, number>;
  [MessageType.GET_ALL_STATS]: DailyStats[];
  [MessageType.GET_LAST_N_DAYS_STATS]: DailyStats[];
  [MessageType.GET_NEXT_N_DAYS_STATS]: UpcomingReviewStats[];
};

/**
 * Type-safe wrapper for sending messages to the background script
 */
export async function sendMessage<T extends MessageRequest>(message: T): Promise<MessageResponseMap[T['type']]> {
  return browser.runtime.sendMessage(message);
}
