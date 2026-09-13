import { defineExtensionMessaging, type GetDataType, type GetReturnType } from '@webext-core/messaging';
import { z } from 'zod';
import { type Card, noteTextSchema, problemDescriptorSchema, rateCardInputSchema } from '@/domain/cards';
import { type GistConnectionResult, type GistSyncStatus, gistSetupSchema, type SyncResult } from '@/domain/gist-sync';
import { settingsUpdateSchema } from '@/domain/settings';

const slugSchema = problemDescriptorSchema.shape.slug;
const daysSchema = z.int().nonnegative();

export const messagePayloadSchemas = {
  waitForInitialization: z.undefined(),
  addCard: z.object({ problem: problemDescriptorSchema }),
  removeCard: z.object({ slug: slugSchema }),
  delayCard: z.object({ slug: slugSchema, days: daysSchema }),
  setPauseStatus: z.object({ slug: slugSchema, paused: z.boolean() }),
  rateCard: z.object({ input: rateCardInputSchema }),
  saveNote: z.object({ slug: slugSchema, text: noteTextSchema }),
  deleteNote: z.object({ slug: slugSchema }),
  updateSettings: z.object({ changes: settingsUpdateSchema }),
  importData: z.object({ jsonData: z.string() }),
  resetAllData: z.undefined(),
  setupGistSync: gistSetupSchema,
  setGistSyncEnabled: z.object({ enabled: z.boolean() }),
  getGistSyncStatus: z.undefined(),
  triggerGistSync: z.undefined(),
};

type MessagePayload<Name extends keyof typeof messagePayloadSchemas> = z.infer<(typeof messagePayloadSchemas)[Name]>;

export interface ExtensionMessageMap {
  waitForInitialization(): void;
  addCard(data: MessagePayload<'addCard'>): Card;
  removeCard(data: MessagePayload<'removeCard'>): void;
  delayCard(data: MessagePayload<'delayCard'>): Card;
  setPauseStatus(data: MessagePayload<'setPauseStatus'>): Card;
  rateCard(data: MessagePayload<'rateCard'>): { card: Card; shouldRequeue: boolean };
  saveNote(data: MessagePayload<'saveNote'>): void;
  deleteNote(data: MessagePayload<'deleteNote'>): void;
  updateSettings(data: MessagePayload<'updateSettings'>): void;
  importData(data: MessagePayload<'importData'>): void;
  resetAllData(): void;
  setupGistSync(data: MessagePayload<'setupGistSync'>): GistConnectionResult;
  setGistSyncEnabled(data: MessagePayload<'setGistSyncEnabled'>): GistConnectionResult;
  getGistSyncStatus(): GistSyncStatus;
  triggerGistSync(): SyncResult;
}

export type MessageName = keyof ExtensionMessageMap;
export type MessageData<Name extends MessageName> = GetDataType<ExtensionMessageMap[Name]>;
export type MessageResult<Name extends MessageName> = GetReturnType<ExtensionMessageMap[Name]>;

export const { onMessage, sendMessage } = defineExtensionMessaging<ExtensionMessageMap>();
