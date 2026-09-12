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
import { markDataUpdated } from '@/infrastructure/storage/data-tracker';
import { readGistConnection } from '@/infrastructure/storage/gist-connection';
import { runStartupMigrations } from '@/infrastructure/storage/migrations/runner';
import {
  addCard,
  delayCard,
  deleteNote,
  getAllCards,
  getNote,
  getReviewQueue,
  rateCard,
  removeCard,
  saveNote,
  setPauseStatus,
} from '@/services/cards';
import { shouldResetEditor } from '@/services/editor-reset';
import { createNewGist, setGistSyncConfig, validateGistId } from '@/services/gist-setup';
import { validatePat } from '@/services/github-auth';
import { getGistSyncStatus, triggerGistSync } from '@/services/github-sync';
import { exportData, importData, resetAllData } from '@/services/import-export';
import { getSettings, updateSettings } from '@/services/settings';
import { getCardStateStats, getLastNDaysStats, getNextNDaysStats, getTodayStats } from '@/services/stats';

type Command<Name extends MessageName> = {
  handler: (data: MessageData<Name>) => MaybePromise<MessageResult<Name>>;
} & ({ kind: 'read' } | { kind: 'write'; updateDataTimestamp?: boolean; refreshBadge: boolean });

const payloadSchemas: { [Name in MessageName]: z.ZodType<MessageData<Name>> } = messagePayloadSchemas;

function read<Data, Result>(handler: (data: Data) => MaybePromise<Result>) {
  return { kind: 'read' as const, handler };
}

type WriteOptions = {
  // Set dataUpdatedAt to now after success so Gist sync can compare dataset freshness.
  updateDataTimestamp?: boolean;
  refreshBadge?: boolean;
};

function write<Data, Result>(
  handler: (data: Data) => MaybePromise<Result>,
  { updateDataTimestamp = false, refreshBadge = false }: WriteOptions = {}
) {
  return { kind: 'write' as const, handler, updateDataTimestamp, refreshBadge };
}

const commands: { [Name in MessageName]: Command<Name> } = {
  addCard: write(({ problem }) => addCard(problem), { updateDataTimestamp: true, refreshBadge: true }),
  getAllCards: read(getAllCards),
  removeCard: write(({ slug }) => removeCard(slug), { updateDataTimestamp: true, refreshBadge: true }),
  delayCard: write(({ slug, days }) => delayCard(slug, days), { updateDataTimestamp: true, refreshBadge: true }),
  setPauseStatus: write(({ slug, paused }) => setPauseStatus(slug, paused), {
    updateDataTimestamp: true,
    refreshBadge: true,
  }),
  rateCard: write(({ input }) => rateCard(input), { updateDataTimestamp: true, refreshBadge: true }),
  getReviewQueue: read(getReviewQueue),
  getTodayStats: read(getTodayStats),
  getNote: read(({ slug }) => getNote(slug)),
  saveNote: write(({ slug, text }) => saveNote(slug, text), { updateDataTimestamp: true }),
  deleteNote: write(({ slug }) => deleteNote(slug), { updateDataTimestamp: true }),
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
  // Keep message and alarm handlers from accessing storage while startup migrations are running.
  const readyPromise = (async () => {
    await runStartupMigrations();

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
      if (command.kind === 'write') {
        if (command.updateDataTimestamp) await markDataUpdated();
        if (command.refreshBadge) await updateBadge();
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
