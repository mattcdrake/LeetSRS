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
import { getBadgeEnabled, getSettings, updateSettings } from '@/services/settings';
import { getCardStateStats, getLastNDaysStats, getNextNDaysStats, getTodayStats } from '@/services/stats';
import { onMessage } from '@/shared/messages';

const SYNC_ALARM_NAME = 'gist-sync';
const SYNC_INTERVAL_MINUTES = 1;

async function updateBadge() {
  const enabled = await getBadgeEnabled();
  if (enabled) {
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

  // Register alarm listener synchronously at top level (required for MV3 service workers)
  // The listener awaits readyPromise internally before proceeding
  browser.alarms.onAlarm.addListener(async (alarm) => {
    if (alarm.name !== SYNC_ALARM_NAME) return;

    // Wait for initialization before handling
    await readyPromise;

    // Refresh badge on periodic alarm
    await updateBadge();

    const config = await getGistSyncConfig();
    if (config.enabled && config.pat && config.gistId) {
      await triggerGistSync();
    }
  });

  const handleRequest = async <T>(handler: () => T | Promise<T>): Promise<T> => {
    await readyPromise;
    return handler();
  };

  const handleDataUpdate = async <T>(handler: () => Promise<T>): Promise<T> => {
    return handleRequest(async () => {
      const result = await handler();
      await markDataUpdated();
      await updateBadge();
      return result;
    });
  };

  onMessage('ping', () => handleRequest(() => 'PONG' as const));
  onMessage('addCard', ({ data }) => handleDataUpdate(() => addCard(data.problem)));
  onMessage('getAllCards', () => handleRequest(getAllCards));
  onMessage('removeCard', ({ data }) => handleDataUpdate(() => removeCard(data.slug)));
  onMessage('delayCard', ({ data }) => handleDataUpdate(() => delayCard(data.slug, data.days)));
  onMessage('setPauseStatus', ({ data }) => handleDataUpdate(() => setPauseStatus(data.slug, data.paused)));
  onMessage('rateCard', ({ data }) => handleDataUpdate(() => rateCard(data.input)));
  onMessage('getReviewQueue', () => handleRequest(getReviewQueue));
  onMessage('getTodayStats', () => handleRequest(getTodayStats));
  onMessage('getNote', ({ data }) => handleRequest(() => getNote(data.cardId)));
  onMessage('saveNote', ({ data }) => handleDataUpdate(() => saveNote(data.cardId, data.text)));
  onMessage('deleteNote', ({ data }) => handleDataUpdate(() => deleteNote(data.cardId)));
  onMessage('getSettings', () => handleRequest(getSettings));
  onMessage('updateSettings', ({ data }) => handleDataUpdate(() => updateSettings(data.changes)));
  onMessage('shouldResetEditor', ({ data }) => handleRequest(() => shouldResetEditor(data.slug, data.domain)));
  onMessage('getCardStateStats', () => handleRequest(getCardStateStats));
  onMessage('getLastNDaysStats', ({ data }) => handleRequest(() => getLastNDaysStats(data.days)));
  onMessage('getNextNDaysStats', ({ data }) => handleRequest(() => getNextNDaysStats(data.days)));
  onMessage('exportData', () => handleRequest(exportData));
  onMessage('importData', ({ data }) => handleRequest(() => importData(data.jsonData)));
  onMessage('resetAllData', () => handleRequest(resetAllData));
  onMessage('getGistSyncConfig', () => handleRequest(getGistSyncConfig));
  onMessage('setGistSyncConfig', ({ data }) => handleRequest(() => setGistSyncConfig(data.config)));
  onMessage('getGistSyncStatus', () => handleRequest(getGistSyncStatus));
  onMessage('triggerGistSync', () => handleRequest(triggerGistSync));
  onMessage('createNewGist', () => handleRequest(createNewGist));
  onMessage('validatePat', ({ data }) => handleRequest(() => validatePat(data.pat)));
  onMessage('validateGistId', ({ data }) => handleRequest(() => validateGistId(data.gistId, data.pat)));
});
