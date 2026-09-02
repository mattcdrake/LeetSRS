import { browser } from 'wxt/browser';
import {
  addCard,
  delayCard,
  getAllCards,
  getReviewQueue,
  rateCard,
  removeCard,
  setPauseStatus,
} from '@/services/cards';
import { markDataUpdated } from '@/services/data-tracker';
import { shouldResetEditor } from '@/services/editor-reset';
import {
  createNewGist,
  getGistSyncConfig,
  getGistSyncStatus,
  setGistSyncConfig,
  triggerGistSync,
  validateGistId,
  validatePat,
} from '@/services/github-sync';
import { exportData, importData, resetAllData } from '@/services/import-export';
import { migrations, runMigrations } from '@/services/migrations';
import { deleteNote, getNote, saveNote } from '@/services/notes';
import { getSettings, updateSettings } from '@/services/settings';
import { getCardStateStats, getLastNDaysStats, getNextNDaysStats, getTodayStats } from '@/services/stats';
import type { BackgroundMessageRegistry } from '@/shared/messages';
import { registerBackgroundMessages } from './messaging';

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
  // Initialize async and track completion so message handlers can wait
  const readyPromise = (async () => {
    await runMigrations(migrations).catch((error) => {
      console.error('Failed to run migrations:', error);
    });

    // Set up periodic sync alarm if not already scheduled
    const existingAlarm = await browser.alarms.get(SYNC_ALARM_NAME);
    if (!existingAlarm) {
      browser.alarms.create(SYNC_ALARM_NAME, {
        periodInMinutes: SYNC_INTERVAL_MINUTES,
      });
    }

    // Update badge on startup
    await updateBadge();
  })();

  const messages = {
    ping: { kind: 'read', handler: () => 'PONG' as const },
    addCard: {
      kind: 'write',
      syncTrackingOwner: 'executor',
      refreshBadge: true,
      handler: ({ problem }) => addCard(problem),
    },
    getAllCards: { kind: 'read', handler: () => getAllCards() },
    removeCard: {
      kind: 'write',
      syncTrackingOwner: 'executor',
      refreshBadge: true,
      handler: ({ slug }) => removeCard(slug),
    },
    delayCard: {
      kind: 'write',
      syncTrackingOwner: 'executor',
      refreshBadge: true,
      handler: ({ slug, days }) => delayCard(slug, days),
    },
    setPauseStatus: {
      kind: 'write',
      syncTrackingOwner: 'executor',
      refreshBadge: true,
      handler: ({ slug, paused }) => setPauseStatus(slug, paused),
    },
    rateCard: {
      kind: 'write',
      syncTrackingOwner: 'executor',
      refreshBadge: true,
      handler: ({ input }) => rateCard(input),
    },
    getReviewQueue: { kind: 'read', handler: () => getReviewQueue() },
    getTodayStats: { kind: 'read', handler: () => getTodayStats() },
    getNote: { kind: 'read', handler: ({ cardId }) => getNote(cardId) },
    saveNote: {
      kind: 'write',
      syncTrackingOwner: 'executor',
      refreshBadge: false,
      handler: ({ cardId, text }) => saveNote(cardId, text),
    },
    deleteNote: {
      kind: 'write',
      syncTrackingOwner: 'executor',
      refreshBadge: false,
      handler: ({ cardId }) => deleteNote(cardId),
    },
    getSettings: { kind: 'read', handler: () => getSettings() },
    updateSettings: {
      kind: 'write',
      syncTrackingOwner: 'executor',
      refreshBadge: true,
      handler: ({ changes }) => updateSettings(changes),
    },
    shouldResetEditor: {
      kind: 'read',
      handler: ({ slug, domain }) => shouldResetEditor(slug, domain),
    },
    getCardStateStats: { kind: 'read', handler: () => getCardStateStats() },
    getLastNDaysStats: { kind: 'read', handler: ({ days }) => getLastNDaysStats(days) },
    getNextNDaysStats: { kind: 'read', handler: ({ days }) => getNextNDaysStats(days) },
    exportData: { kind: 'read', handler: () => exportData() },
    importData: {
      kind: 'write',
      syncTrackingOwner: 'handler',
      refreshBadge: true,
      handler: ({ jsonData }) => importData(jsonData),
    },
    resetAllData: {
      kind: 'write',
      syncTrackingOwner: 'handler',
      refreshBadge: true,
      handler: () => resetAllData(),
    },
    getGistSyncConfig: { kind: 'read', handler: () => getGistSyncConfig() },
    setGistSyncConfig: {
      kind: 'write',
      syncTrackingOwner: 'none',
      refreshBadge: false,
      handler: ({ config }) => setGistSyncConfig(config),
    },
    getGistSyncStatus: { kind: 'read', handler: () => getGistSyncStatus() },
    triggerGistSync: {
      kind: 'write',
      syncTrackingOwner: 'handler',
      refreshBadge: true,
      handler: () => triggerGistSync(),
    },
    createNewGist: {
      kind: 'write',
      syncTrackingOwner: 'none',
      refreshBadge: false,
      handler: () => createNewGist(),
    },
    validatePat: { kind: 'read', handler: ({ pat }) => validatePat(pat) },
    validateGistId: {
      kind: 'read',
      handler: ({ gistId, pat }) => validateGistId(gistId, pat),
    },
  } satisfies BackgroundMessageRegistry;

  const messageExecutor = registerBackgroundMessages(messages, {
    ready: readyPromise,
    markDataUpdated,
    refreshBadge: updateBadge,
  });

  // Register synchronously during background startup so the MV3 service worker
  // is ready to receive alarms immediately.
  browser.alarms.onAlarm.addListener(async (alarm) => {
    if (alarm.name !== SYNC_ALARM_NAME) return;

    await readyPromise;

    const config = await getGistSyncConfig();
    if (config.enabled && config.pat && config.gistId) {
      await messageExecutor.execute(messages.triggerGistSync, undefined);
    } else {
      await updateBadge();
    }
  });
});
