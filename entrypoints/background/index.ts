import type { MaybePromise } from '@webext-core/messaging';
import { browser } from 'wxt/browser';
import type { z } from 'zod';
import {
  type MessageData,
  type MessageName,
  type MessageResult,
  messagePayloadSchemas,
  onMessage,
} from '@/infrastructure/browser/messages';
import { readGistConnection } from '@/infrastructure/storage/gist-connection';
import { initializeLearningDocument } from '@/infrastructure/storage/learning-document-startup';
import { createNewGist, getGistSyncStatus, triggerGistSync } from '@/services/document-gist-sync';
import { exportData, importData, resetAllData } from '@/services/document-import-export';
import {
  addCard,
  delayCard,
  deleteNote,
  getAllCards,
  getCardStateStats,
  getLastNDaysStats,
  getNextNDaysStats,
  getNote,
  getReviewQueue,
  getTodayStats,
  rateCard,
  removeCard,
  saveNote,
  setPauseStatus,
  shouldResetEditor,
} from '@/services/document-learning';
import { getSettings, updateSettings } from '@/services/document-settings';
import { setGistSyncConfig, validateGistId } from '@/services/gist-sync';
import { validatePat } from '@/services/github-auth';

type Command<Name extends MessageName> = {
  handler: (data: MessageData<Name>) => MaybePromise<MessageResult<Name>>;
} & ({ kind: 'read' } | { kind: 'write'; refreshBadge: boolean });

const payloadSchemas: { [Name in MessageName]: z.ZodType<MessageData<Name>> } = messagePayloadSchemas;

function read<Data, Result>(handler: (data: Data) => MaybePromise<Result>) {
  return { kind: 'read' as const, handler };
}

type WriteOptions = {
  refreshBadge?: boolean;
};

function write<Data, Result>(
  handler: (data: Data) => MaybePromise<Result>,
  { refreshBadge = false }: WriteOptions = {}
) {
  return { kind: 'write' as const, handler, refreshBadge };
}

const commands: { [Name in MessageName]: Command<Name> } = {
  addCard: write(({ problem }) => addCard(problem), { refreshBadge: true }),
  getAllCards: read(getAllCards),
  removeCard: write(({ slug }) => removeCard(slug), { refreshBadge: true }),
  delayCard: write(({ slug, days }) => delayCard(slug, days), { refreshBadge: true }),
  setPauseStatus: write(({ slug, paused }) => setPauseStatus(slug, paused), {
    refreshBadge: true,
  }),
  rateCard: write(({ input }) => rateCard(input), { refreshBadge: true }),
  getReviewQueue: read(getReviewQueue),
  getTodayStats: read(getTodayStats),
  getNote: read(({ slug }) => getNote(slug)),
  saveNote: write(({ slug, text }) => saveNote(slug, text)),
  deleteNote: write(({ slug }) => deleteNote(slug)),
  getSettings: read(getSettings),
  updateSettings: write(({ changes }) => updateSettings(changes), { refreshBadge: true }),
  shouldResetEditor: read(({ slug, domain }) => shouldResetEditor(slug, domain)),
  getCardStateStats: read(getCardStateStats),
  getLastNDaysStats: read(({ days }) => getLastNDaysStats(days)),
  getNextNDaysStats: read(({ days }) => getNextNDaysStats(days)),
  exportData: read(exportData),
  importData: write(({ jsonData }) => importData(jsonData), { refreshBadge: true }),
  resetAllData: write(resetAllData, { refreshBadge: true }),
  getGistSyncConfig: read(readGistConnection),
  setGistSyncConfig: write(({ config }) => setGistSyncConfig(config)),
  getGistSyncStatus: read(getGistSyncStatus),
  triggerGistSync: write(triggerGistSync, { refreshBadge: true }),
  createNewGist: write(createNewGist),
  validatePat: read(({ pat }) => validatePat(pat)),
  validateGistId: read(({ gistId, pat }) => validateGistId(gistId, pat)),
};

const SYNC_ALARM_NAME = 'gist-sync';
const SYNC_INTERVAL_MINUTES = 1;

async function updateBadge() {
  const settings = await getSettings();
  if (settings.badgeEnabled) {
    const queue = await getReviewQueue();
    if (queue.length > 0) {
      await browser.action.setBadgeText({ text: String(queue.length) });
      await browser.action.setBadgeBackgroundColor({ color: '#EF4444' });
      return;
    }
  }
  await browser.action.setBadgeText({ text: '' });
}

export default defineBackground(() => {
  // Keep message and alarm handlers from accessing storage until the learning document is ready.
  const readyPromise = (async () => {
    await initializeLearningDocument();

    const existingAlarm = await browser.alarms.get(SYNC_ALARM_NAME);
    if (!existingAlarm) {
      browser.alarms.create(SYNC_ALARM_NAME, {
        periodInMinutes: SYNC_INTERVAL_MINUTES,
      });
    }

    await updateBadge();
  })();

  // Report startup failure without replacing the rejected readiness promise.
  void readyPromise.catch((error) => {
    console.error('Failed to initialize background:', error);
  });

  // Keep network work and post-handler effects in the same mutation queue.
  // Recover its tail after rejection while returning the original error to callers.
  let writeQueue = Promise.resolve();
  const dispatch = <Name extends MessageName>(name: Name, data: unknown): Promise<MessageResult<Name>> => {
    const command = commands[name];
    const run = async () => {
      await readyPromise;
      // The name selects both the payload schema and the corresponding typed handler.
      const schema: z.ZodType<MessageData<Name>> = payloadSchemas[name];
      const payload = schema.parse(data);
      const result = await command.handler(payload);
      if (command.kind === 'write' && command.refreshBadge) {
        try {
          await updateBadge();
        } catch (error) {
          console.warn('Failed to refresh badge:', error);
        }
      }
      return result;
    };
    if (command.kind === 'read') return run();
    const result = writeQueue.then(run);
    writeQueue = result.then(
      () => undefined,
      () => undefined
    );
    return result;
  };

  for (const name of Object.keys(commands) as MessageName[]) {
    onMessage(name, ({ data }) => dispatch(name, data));
  }

  // Register synchronously during background startup so the MV3 service worker
  // is ready to receive alarms immediately.
  browser.alarms.onAlarm.addListener(async (alarm) => {
    if (alarm.name !== SYNC_ALARM_NAME) return;

    try {
      await readyPromise;
    } catch {
      // Startup already reported the failure; alarms have no caller to receive it.
      return;
    }

    const config = await readGistConnection();
    if (config.enabled && config.pat && config.gistId) {
      await dispatch('triggerGistSync', undefined);
    } else {
      await updateBadge();
    }
  });
});
