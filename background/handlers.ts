import { browser } from 'wxt/browser';
import { storage } from '#imports';
import { BADGE_ALARM_NAME, refreshBadge } from '@/background/badge';
import {
  getGistSyncStatus,
  invalidateGistSync,
  setGistSyncEnabled,
  setupGistSync,
  triggerGistSync,
} from '@/background/gist-sync';
import { importData, resetAllData } from '@/background/import-export';
import {
  addCard,
  delayCard,
  rateCard,
  removeCard,
  saveNote,
  setPauseStatus,
  updateSettings,
} from '@/background/learning';
import { initializeLearningDocument } from '@/background/legacy/learning-document-startup';
import { messagePayloadSchemas, onMessage } from '@/shared/messages';
import { STORAGE_KEYS, setBackgroundStorageReadiness } from '@/shared/storage';

const SYNC_ALARM_NAME = 'gist-sync';
const SYNC_INTERVAL_MINUTES = 1;
export function startBackground() {
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
    void triggerGistSync();
  })();
  setBackgroundStorageReadiness(readyPromise);

  // Report startup failure without replacing the rejected readiness promise.
  void readyPromise.catch((error) => {
    console.error('Failed to initialize background:', error);
  });

  onMessage('waitForInitialization', async ({ data }) => {
    await readyPromise;
    messagePayloadSchemas.waitForInitialization.parse(data);
    return undefined;
  });
  onMessage('addCard', async ({ data }) => {
    await readyPromise;
    return addCard(messagePayloadSchemas.addCard.parse(data).problem);
  });
  onMessage('removeCard', async ({ data }) => {
    await readyPromise;
    return removeCard(messagePayloadSchemas.removeCard.parse(data).slug);
  });
  onMessage('delayCard', async ({ data }) => {
    await readyPromise;
    const payload = messagePayloadSchemas.delayCard.parse(data);
    return delayCard(payload.slug, payload.days);
  });
  onMessage('setPauseStatus', async ({ data }) => {
    await readyPromise;
    const payload = messagePayloadSchemas.setPauseStatus.parse(data);
    return setPauseStatus(payload.slug, payload.paused);
  });
  onMessage('rateCard', async ({ data }) => {
    await readyPromise;
    return rateCard(messagePayloadSchemas.rateCard.parse(data).input);
  });
  onMessage('saveNote', async ({ data }) => {
    await readyPromise;
    const payload = messagePayloadSchemas.saveNote.parse(data);
    return saveNote(payload.slug, payload.text);
  });
  onMessage('updateSettings', async ({ data }) => {
    await readyPromise;
    return updateSettings(messagePayloadSchemas.updateSettings.parse(data).changes);
  });
  onMessage('importData', async ({ data }) => {
    await readyPromise;
    return importData(messagePayloadSchemas.importData.parse(data).jsonData);
  });
  onMessage('resetAllData', async ({ data }) => {
    await readyPromise;
    messagePayloadSchemas.resetAllData.parse(data);
    return resetAllData();
  });
  onMessage('setupGistSync', async ({ data }) => {
    await readyPromise;
    return setupGistSync(messagePayloadSchemas.setupGistSync.parse(data));
  });
  onMessage('setGistSyncEnabled', async ({ data }) => {
    await readyPromise;
    return setGistSyncEnabled(messagePayloadSchemas.setGistSyncEnabled.parse(data).enabled);
  });
  onMessage('getGistSyncStatus', async ({ data }) => {
    await readyPromise;
    messagePayloadSchemas.getGistSyncStatus.parse(data);
    return getGistSyncStatus();
  });
  storage.watch(STORAGE_KEYS.gistConnection, () => {
    invalidateGistSync();
    void readyPromise.then(triggerGistSync, () => {});
  });
  storage.watch(STORAGE_KEYS.learningDocument, () => {
    void readyPromise.then(refreshBadge, () => {});
  });

  // Register synchronously during background startup so the MV3 service worker
  // is ready to receive alarms immediately.
  browser.alarms.onAlarm.addListener(async (alarm) => {
    if (alarm.name !== SYNC_ALARM_NAME && alarm.name !== BADGE_ALARM_NAME) return;

    try {
      await readyPromise;
    } catch {
      // Startup already reported the failure; alarms have no caller to receive it.
      return;
    }

    await Promise.all([alarm.name === SYNC_ALARM_NAME && triggerGistSync(), refreshBadge()]);
  });
}
