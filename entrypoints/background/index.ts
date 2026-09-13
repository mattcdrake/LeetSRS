import { browser } from 'wxt/browser';
import { messagePayloadSchemas, onMessage } from '@/infrastructure/browser/messages';
import { initializeLearningDocument } from '@/infrastructure/storage/learning-document-startup';
import { getReviewQueue, getSettings } from '@/infrastructure/storage/learning-queries';
import {
  getGistSyncStatus,
  invalidateGistSync,
  refreshGistOnArrival,
  requestAutomaticSync,
  setGistSyncEnabled,
  setupGistSync,
  triggerGistSync,
  waitForArrivalRefresh,
} from '@/services/gist-sync';
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

    void refreshBadge();
  })();

  // Report startup failure without replacing the rejected readiness promise.
  void readyPromise.catch((error) => {
    console.error('Failed to initialize background:', error);
  });

  async function refreshBadge() {
    try {
      await updateBadge();
    } catch (error) {
      console.warn('Failed to refresh badge:', error);
    }
  }
  onMessage('waitForInitialization', async ({ data }) => {
    await readyPromise;
    messagePayloadSchemas.waitForInitialization.parse(data);
    return undefined;
  });
  onMessage('addCard', async ({ data }) => {
    await readyPromise;
    await waitForArrivalRefresh();
    const payload = messagePayloadSchemas.addCard.parse(data);
    return addCard(payload.problem);
  });
  onMessage('removeCard', async ({ data }) => {
    await readyPromise;
    await waitForArrivalRefresh();
    const payload = messagePayloadSchemas.removeCard.parse(data);
    return removeCard(payload.slug);
  });
  onMessage('delayCard', async ({ data }) => {
    await readyPromise;
    await waitForArrivalRefresh();
    const payload = messagePayloadSchemas.delayCard.parse(data);
    return delayCard(payload.slug, payload.days);
  });
  onMessage('setPauseStatus', async ({ data }) => {
    await readyPromise;
    await waitForArrivalRefresh();
    const payload = messagePayloadSchemas.setPauseStatus.parse(data);
    return setPauseStatus(payload.slug, payload.paused);
  });
  onMessage('rateCard', async ({ data }) => {
    await readyPromise;
    await waitForArrivalRefresh();
    const payload = messagePayloadSchemas.rateCard.parse(data);
    return rateCard(payload.input);
  });
  onMessage('saveNote', async ({ data }) => {
    await readyPromise;
    await waitForArrivalRefresh();
    const payload = messagePayloadSchemas.saveNote.parse(data);
    return saveNote(payload.slug, payload.text);
  });
  onMessage('deleteNote', async ({ data }) => {
    await readyPromise;
    await waitForArrivalRefresh();
    const payload = messagePayloadSchemas.deleteNote.parse(data);
    return deleteNote(payload.slug);
  });
  onMessage('updateSettings', async ({ data }) => {
    await readyPromise;
    await waitForArrivalRefresh();
    const payload = messagePayloadSchemas.updateSettings.parse(data);
    return updateSettings(payload.changes);
  });
  onMessage('importData', async ({ data }) => {
    await readyPromise;
    const payload = messagePayloadSchemas.importData.parse(data);
    return importData(payload.jsonData);
  });
  onMessage('resetAllData', async ({ data }) => {
    await readyPromise;
    messagePayloadSchemas.resetAllData.parse(data);
    return resetAllData();
  });
  onMessage('setupGistSync', async ({ data }) => {
    await readyPromise;
    const payload = messagePayloadSchemas.setupGistSync.parse(data);
    return setupGistSync(payload);
  });
  onMessage('setGistSyncEnabled', async ({ data }) => {
    await readyPromise;
    const payload = messagePayloadSchemas.setGistSyncEnabled.parse(data);
    return setGistSyncEnabled(payload.enabled);
  });
  onMessage('getGistSyncStatus', async ({ data }) => {
    await readyPromise;
    messagePayloadSchemas.getGistSyncStatus.parse(data);
    return getGistSyncStatus();
  });
  onMessage('triggerGistSync', async ({ data }) => {
    await readyPromise;
    messagePayloadSchemas.triggerGistSync.parse(data);
    return triggerGistSync();
  });

  onMessage('refreshGistOnArrival', async ({ data }) => {
    await readyPromise;
    messagePayloadSchemas.refreshGistOnArrival.parse(data);
    return refreshGistOnArrival();
  });

  browser.storage.onChanged.addListener((changes, area) => {
    if (area === 'sync' && 'leetsrs:gistConnection' in changes) invalidateGistSync();
    if (area === 'local' && 'leetsrs:learningDocument' in changes) {
      void readyPromise.then(refreshBadge, () => {});
    }
  });

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

    await Promise.all([requestAutomaticSync(), refreshBadge()]);
  });
});
