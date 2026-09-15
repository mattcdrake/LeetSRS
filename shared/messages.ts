import { defineExtensionMessaging, type GetDataType, type GetReturnType } from '@webext-core/messaging';
import { z } from 'zod';
import {
  type GistConnectionResult,
  type GistSyncStatus,
  gistSetupSchema,
  noteTextSchema,
  type ProblemDescriptor,
  problemDescriptorSchema,
  problemReferenceSchema,
  rateCardInputSchema,
} from '@/shared/models';

import { settingsUpdateSchema } from '@/shared/settings';

const frontendIdSchema = problemReferenceSchema.shape.frontendId;
const daysSchema = z.int().nonnegative();

export const messagePayloadSchemas = {
  waitForInitialization: z.undefined(),
  getProblem: z.object({ slug: problemDescriptorSchema.shape.slug, domain: problemReferenceSchema.shape.domain }),
  addCard: z.object({ problem: problemReferenceSchema }),
  removeCard: z.object({ frontendId: frontendIdSchema }),
  delayCard: z.object({ frontendId: frontendIdSchema, days: daysSchema }),
  setPauseStatus: z.object({ frontendId: frontendIdSchema, paused: z.boolean() }),
  rateCard: z.object({ input: rateCardInputSchema }),
  saveNote: z.object({ frontendId: frontendIdSchema, text: noteTextSchema }),
  updateSettings: z.object({ changes: settingsUpdateSchema }),
  importData: z.object({ jsonData: z.string() }),
  resetAllData: z.undefined(),
  setupGistSync: gistSetupSchema,
  setGistSyncEnabled: z.object({ enabled: z.boolean() }),
  getGistSyncStatus: z.undefined(),
};

type MessagePayload<Name extends keyof typeof messagePayloadSchemas> = z.infer<(typeof messagePayloadSchemas)[Name]>;

export interface ExtensionMessageMap {
  waitForInitialization(): void;
  getProblem(data: MessagePayload<'getProblem'>): ProblemDescriptor;
  addCard(data: MessagePayload<'addCard'>): void;
  removeCard(data: MessagePayload<'removeCard'>): void;
  delayCard(data: MessagePayload<'delayCard'>): void;
  setPauseStatus(data: MessagePayload<'setPauseStatus'>): void;
  rateCard(data: MessagePayload<'rateCard'>): void;
  saveNote(data: MessagePayload<'saveNote'>): void;
  updateSettings(data: MessagePayload<'updateSettings'>): void;
  importData(data: MessagePayload<'importData'>): void;
  resetAllData(): void;
  setupGistSync(data: MessagePayload<'setupGistSync'>): GistConnectionResult;
  setGistSyncEnabled(data: MessagePayload<'setGistSyncEnabled'>): GistConnectionResult;
  getGistSyncStatus(): GistSyncStatus;
}

export type MessageName = keyof ExtensionMessageMap;
export type MessageData<Name extends MessageName> = GetDataType<ExtensionMessageMap[Name]>;
export type MessageResult<Name extends MessageName> = GetReturnType<ExtensionMessageMap[Name]>;

export const { onMessage, sendMessage } = defineExtensionMessaging<ExtensionMessageMap>();
