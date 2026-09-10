import type { MaybePromise } from '@webext-core/messaging';
import { browser } from 'wxt/browser';
import {
  type MessageData,
  type MessageName,
  type MessageResult,
  messagePayloadSchemas,
  onMessage,
} from '@/infrastructure/browser/messages';
import { markDataUpdated } from '@/infrastructure/storage/data-tracker';
import { runStartupMigrations } from '@/infrastructure/storage/migrations';
import { deleteNote, getNote, saveNote } from '@/infrastructure/storage/notes';
import {
  addCard,
  delayCard,
  getAllCards,
  getReviewQueue,
  rateCard,
  removeCard,
  setPauseStatus,
} from '@/services/cards';
import { shouldResetEditor } from '@/services/editor-reset';
import {
  createNewGist,
  getGistDestinationConfig,
  getGistSyncConfig,
  setGistSyncConfig,
  validateGistId,
} from '@/services/gist-setup';
import { hasGitHubCredentials, validatePat } from '@/services/github-auth';
import { getGistSyncStatus, triggerGistSync } from '@/services/github-sync';
import { exportData, importData, resetAllData } from '@/services/import-export';
import { getSettings, updateSettings } from '@/services/settings';
import { getCardStateStats, getLastNDaysStats, getNextNDaysStats, getTodayStats } from '@/services/stats';

type Command<Name extends MessageName> = {
  handler: (data: MessageData<Name>) => MaybePromise<MessageResult<Name>>;
} & ({ kind: 'read' } | { kind: 'write'; markLocalEdit?: boolean; refreshBadge: boolean });

const commands: { [Name in MessageName]: Command<Name> } = {
  addCard: {
    kind: 'write',
    markLocalEdit: true,
    refreshBadge: true,
    handler: ({ problem }) => addCard(problem),
  },
  getAllCards: { kind: 'read', handler: getAllCards },
  removeCard: {
    kind: 'write',
    markLocalEdit: true,
    refreshBadge: true,
    handler: ({ slug }) => removeCard(slug),
  },
  delayCard: {
    kind: 'write',
    markLocalEdit: true,
    refreshBadge: true,
    handler: ({ slug, days }) => delayCard(slug, days),
  },
  setPauseStatus: {
    kind: 'write',
    markLocalEdit: true,
    refreshBadge: true,
    handler: ({ slug, paused }) => setPauseStatus(slug, paused),
  },
  rateCard: {
    kind: 'write',
    markLocalEdit: true,
    refreshBadge: true,
    handler: ({ input }) => rateCard(input),
  },
  getReviewQueue: { kind: 'read', handler: getReviewQueue },
  getTodayStats: { kind: 'read', handler: getTodayStats },
  getNote: { kind: 'read', handler: ({ cardId }) => getNote(cardId) },
  saveNote: {
    kind: 'write',
    markLocalEdit: true,
    refreshBadge: false,
    handler: ({ cardId, text }) => saveNote(cardId, text),
  },
  deleteNote: {
    kind: 'write',
    markLocalEdit: true,
    refreshBadge: false,
    handler: ({ cardId }) => deleteNote(cardId),
  },
  getSettings: { kind: 'read', handler: getSettings },
  updateSettings: {
    kind: 'write',
    refreshBadge: true,
    handler: ({ changes }) => updateSettings(changes),
  },
  shouldResetEditor: {
    kind: 'read',
    handler: ({ slug, domain }) => shouldResetEditor(slug, domain),
  },
  getCardStateStats: { kind: 'read', handler: getCardStateStats },
  getLastNDaysStats: {
    kind: 'read',
    handler: ({ days }) => getLastNDaysStats(days),
  },
  getNextNDaysStats: {
    kind: 'read',
    handler: ({ days }) => getNextNDaysStats(days),
  },
  exportData: { kind: 'read', handler: exportData },
  importData: {
    kind: 'write',
    refreshBadge: true,
    handler: ({ jsonData }) => importData(jsonData),
  },
  resetAllData: {
    kind: 'write',
    refreshBadge: true,
    handler: resetAllData,
  },
  getGistSyncConfig: { kind: 'read', handler: getGistSyncConfig },
  setGistSyncConfig: {
    kind: 'write',
    refreshBadge: false,
    handler: ({ config }) => setGistSyncConfig(config),
  },
  getGistSyncStatus: { kind: 'read', handler: getGistSyncStatus },
  triggerGistSync: {
    kind: 'write',
    refreshBadge: true,
    handler: triggerGistSync,
  },
  createNewGist: {
    kind: 'write',
    refreshBadge: false,
    handler: createNewGist,
  },
  validatePat: { kind: 'read', handler: ({ pat }) => validatePat(pat) },
  validateGistId: {
    kind: 'read',
    handler: ({ gistId, pat }) => validateGistId(gistId, pat),
  },
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
      const payload = messagePayloadSchemas[name].parse(data) as MessageData<Name>;
      const result = await command.handler(payload);
      if (command.kind === 'write') {
        if (command.markLocalEdit) await markDataUpdated();
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

    const [config, hasCredentials] = await Promise.all([getGistDestinationConfig(), hasGitHubCredentials()]);
    if (config.enabled && hasCredentials && config.gistId) {
      await dispatch('triggerGistSync', undefined);
    } else {
      await updateBadge();
    }
  });
});
