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
import { getReviewQueue, getSettings } from '@/infrastructure/storage/learning-queries';
import { getGistSyncStatus, setGistSyncEnabled, setupGistSync, triggerGistSync } from '@/services/gist-sync';
import { importData, resetAllData } from '@/services/import-export';
import {
  addCard,
  delayCard,
  deleteNote,
  rateCard,
  removeCard,
  saveNote,
  setPauseStatus,
  updateSettings,
} from '@/services/learning';

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
  waitForInitialization: read(() => undefined),
  addCard: write(({ problem }) => addCard(problem), { refreshBadge: true }),
  removeCard: write(({ slug }) => removeCard(slug), { refreshBadge: true }),
  delayCard: write(({ slug, days }) => delayCard(slug, days), { refreshBadge: true }),
  setPauseStatus: write(({ slug, paused }) => setPauseStatus(slug, paused), {
    refreshBadge: true,
  }),
  rateCard: write(({ input }) => rateCard(input), { refreshBadge: true }),
  saveNote: write(({ slug, text }) => saveNote(slug, text)),
  deleteNote: write(({ slug }) => deleteNote(slug)),
  updateSettings: write(({ changes }) => updateSettings(changes), { refreshBadge: true }),
  importData: write(({ jsonData }) => importData(jsonData), { refreshBadge: true }),
  resetAllData: write(resetAllData, { refreshBadge: true }),
  setupGistSync: write(setupGistSync, { refreshBadge: true }),
  setGistSyncEnabled: write(({ enabled }) => setGistSyncEnabled(enabled), { refreshBadge: true }),
  getGistSyncStatus: read(getGistSyncStatus),
  triggerGistSync: write(triggerGistSync, { refreshBadge: true }),
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
  const enqueue = <Result>(run: () => Promise<Result>): Promise<Result> => {
    const result = writeQueue.then(run);
    writeQueue = result.then(
      () => undefined,
      () => undefined
    );
    return result;
  };
  const refreshBadge = async () => {
    try {
      await updateBadge();
    } catch (error) {
      console.warn('Failed to refresh badge:', error);
    }
  };
  const dispatch = <Name extends MessageName>(name: Name, data: unknown): Promise<MessageResult<Name>> => {
    const command = commands[name];
    const run = async () => {
      await readyPromise;
      // The name selects both the payload schema and the corresponding typed handler.
      const schema: z.ZodType<MessageData<Name>> = payloadSchemas[name];
      const payload = schema.parse(data);
      const result = await command.handler(payload);
      if (command.kind === 'write' && command.refreshBadge) {
        await refreshBadge();
      }
      return result;
    };
    if (command.kind === 'read') return run();
    return enqueue(run);
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

    await enqueue(async () => {
      const config = await readGistConnection();
      if (config.enabled && config.pat.trim() && config.gistId?.trim()) {
        await triggerGistSync();
      }
      await refreshBadge();
    });
  });
});
