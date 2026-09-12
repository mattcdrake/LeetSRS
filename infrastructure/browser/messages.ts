import { defineExtensionMessaging, type GetDataType, type GetReturnType } from '@webext-core/messaging';
import type { State as FsrsState } from 'ts-fsrs';
import { z } from 'zod';
import { type Card, noteTextSchema, problemDescriptorSchema, rateCardInputSchema } from '@/domain/cards';
import {
  type GistSyncConfig,
  type GistSyncStatus,
  type GistValidationResult,
  gistSyncConfigUpdateSchema,
  type PatValidationResult,
  type SyncResult,
} from '@/domain/gist-sync';
import { type Settings, settingsUpdateSchema } from '@/domain/settings';
import type { DailyStats, UpcomingReviewStats } from '@/domain/statistics';

const slugSchema = problemDescriptorSchema.shape.slug;
const daysSchema = z.int().nonnegative();

export const messagePayloadSchemas = {
  addCard: z.object({ problem: problemDescriptorSchema }),
  getAllCards: z.undefined(),
  removeCard: z.object({ slug: slugSchema }),
  delayCard: z.object({ slug: slugSchema, days: daysSchema }),
  setPauseStatus: z.object({ slug: slugSchema, paused: z.boolean() }),
  rateCard: z.object({ input: rateCardInputSchema }),
  getReviewQueue: z.undefined(),
  getTodayStats: z.undefined(),
  getNote: z.object({ slug: slugSchema }),
  saveNote: z.object({ slug: slugSchema, text: noteTextSchema }),
  deleteNote: z.object({ slug: slugSchema }),
  getSettings: z.undefined(),
  updateSettings: z.object({ changes: settingsUpdateSchema }),
  shouldResetEditor: problemDescriptorSchema.pick({ slug: true, domain: true }),
  getCardStateStats: z.undefined(),
  getLastNDaysStats: z.object({ days: daysSchema }),
  getNextNDaysStats: z.object({ days: daysSchema }),
  exportData: z.undefined(),
  importData: z.object({ jsonData: z.string() }),
  resetAllData: z.undefined(),
  getGistSyncConfig: z.undefined(),
  setGistSyncConfig: z.object({ config: gistSyncConfigUpdateSchema }),
  getGistSyncStatus: z.undefined(),
  triggerGistSync: z.undefined(),
  createNewGist: z.undefined(),
  validatePat: z.object({ pat: z.string() }),
  validateGistId: z.object({ gistId: z.string(), pat: z.string() }),
};

type MessagePayload<Name extends keyof typeof messagePayloadSchemas> = z.infer<(typeof messagePayloadSchemas)[Name]>;

export interface ExtensionMessageMap {
  addCard(data: MessagePayload<'addCard'>): Card;
  getAllCards(): Card[];
  removeCard(data: MessagePayload<'removeCard'>): void;
  delayCard(data: MessagePayload<'delayCard'>): Card;
  setPauseStatus(data: MessagePayload<'setPauseStatus'>): Card;
  rateCard(data: MessagePayload<'rateCard'>): { card: Card; shouldRequeue: boolean };
  getReviewQueue(): Card[];
  getTodayStats(): DailyStats | null;
  getNote(data: MessagePayload<'getNote'>): string | null;
  saveNote(data: MessagePayload<'saveNote'>): void;
  deleteNote(data: MessagePayload<'deleteNote'>): void;
  getSettings(): Settings;
  updateSettings(data: MessagePayload<'updateSettings'>): void;
  shouldResetEditor(data: MessagePayload<'shouldResetEditor'>): boolean;
  getCardStateStats(): Record<FsrsState, number>;
  getLastNDaysStats(data: MessagePayload<'getLastNDaysStats'>): DailyStats[];
  getNextNDaysStats(data: MessagePayload<'getNextNDaysStats'>): UpcomingReviewStats[];
  exportData(): string;
  importData(data: MessagePayload<'importData'>): void;
  resetAllData(): void;
  getGistSyncConfig(): GistSyncConfig;
  setGistSyncConfig(data: MessagePayload<'setGistSyncConfig'>): void;
  getGistSyncStatus(): GistSyncStatus;
  triggerGistSync(): SyncResult;
  createNewGist(): { gistId: string };
  validatePat(data: MessagePayload<'validatePat'>): PatValidationResult;
  validateGistId(data: MessagePayload<'validateGistId'>): GistValidationResult;
}

export type MessageName = keyof ExtensionMessageMap;
export type MessageData<Name extends MessageName> = GetDataType<ExtensionMessageMap[Name]>;
export type MessageResult<Name extends MessageName> = GetReturnType<ExtensionMessageMap[Name]>;

export const { onMessage, sendMessage } = defineExtensionMessaging<ExtensionMessageMap>();
