import { browser } from 'wxt/browser';
import { storage } from '#imports';
import { messagePayloadSchemas, onMessage } from '@/infrastructure/browser/messages';
import { initializeLearningDocument } from '@/infrastructure/storage/learning-document-startup';
import { getBadgeState } from '@/infrastructure/storage/learning-queries';
import { STORAGE_KEYS } from '@/infrastructure/storage/storage-keys';
import {
  getGistSyncStatus,
  invalidateGistSync,
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
const BADGE_ALARM_NAME = 'badge-refresh';

async function refreshBadge() {
  try {
    const { count, nextDueAt } = await getBadgeState();
    const alarm = await browser.alarms.get(BADGE_ALARM_NAME);
    if (nextDueAt === undefined) await browser.alarms.clear(BADGE_ALARM_NAME);
    else if (alarm?.scheduledTime !== nextDueAt) await browser.alarms.create(BADGE_ALARM_NAME, { when: nextDueAt });
    await browser.action.setBadgeText({ text: count ? String(count) : '' });
    if (count) await browser.action.setBadgeBackgroundColor({ color: '#EF4444' });
  } catch (error) {
    console.warn('Failed to refresh badge:', error);
  }
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

  async function readyToEdit() {
    await readyPromise;
    await waitForArrivalRefresh();
  }
  onMessage('waitForInitialization', async ({ data }) => {
    await readyPromise;
    messagePayloadSchemas.waitForInitialization.parse(data);
    return undefined;
  });
  onMessage('addCard', async ({ data }) => {
    await readyToEdit();
    return addCard(messagePayloadSchemas.addCard.parse(data).problem);
  });
  onMessage('removeCard', async ({ data }) => {
    await readyToEdit();
    return removeCard(messagePayloadSchemas.removeCard.parse(data).slug);
  });
  onMessage('delayCard', async ({ data }) => {
    await readyToEdit();
    const payload = messagePayloadSchemas.delayCard.parse(data);
    return delayCard(payload.slug, payload.days);
  });
  onMessage('setPauseStatus', async ({ data }) => {
    await readyToEdit();
    const payload = messagePayloadSchemas.setPauseStatus.parse(data);
    return setPauseStatus(payload.slug, payload.paused);
  });
  onMessage('rateCard', async ({ data }) => {
    await readyToEdit();
    return rateCard(messagePayloadSchemas.rateCard.parse(data).input);
  });
  onMessage('saveNote', async ({ data }) => {
    await readyToEdit();
    const payload = messagePayloadSchemas.saveNote.parse(data);
    return saveNote(payload.slug, payload.text);
  });
  onMessage('deleteNote', async ({ data }) => {
    await readyToEdit();
    return deleteNote(messagePayloadSchemas.deleteNote.parse(data).slug);
  });
  onMessage('updateSettings', async ({ data }) => {
    await readyToEdit();
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
  onMessage('triggerGistSync', async ({ data }) => {
    await readyPromise;
    messagePayloadSchemas.triggerGistSync.parse(data);
    return triggerGistSync();
  });

  onMessage('refreshGistOnArrival', async ({ data }) => {
    await readyPromise;
    messagePayloadSchemas.refreshGistOnArrival.parse(data);
    return triggerGistSync('arrival');
  });

  storage.watch(STORAGE_KEYS.gistConnection, () => invalidateGistSync());
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

    await Promise.all([alarm.name === SYNC_ALARM_NAME && triggerGistSync('alarm'), refreshBadge()]);
  });
});
