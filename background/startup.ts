import { registerService } from '@webext-core/proxy-service';
import { browser } from 'wxt/browser';
import { storage } from '#imports';
import { BADGE_ALARM_NAME, refreshBadge } from '@/background/badge';
import { initializeLearningDocument } from '@/background/legacy/learning-document-startup';
import { sync, watchGistConnectionChanges } from '@/background/persistence';
import { createBackgroundService } from '@/background/service';
import { BACKGROUND_SERVICE_KEY } from '@/shared/background-service';
import { initializeCatalog } from '@/shared/catalog';
import { STORAGE_KEYS, setBackgroundStorageReadiness } from '@/shared/storage';

const SYNC_ALARM_NAME = 'gist-sync';
const SYNC_INTERVAL_MINUTES = 1;
export function startBackground() {
  // Commands and alarms wait until both learning storage and the catalog are ready.
  const readyPromise = (async () => {
    await initializeCatalog();
    await initializeLearningDocument();

    const existingAlarm = await browser.alarms.get(SYNC_ALARM_NAME);
    if (!existingAlarm) {
      browser.alarms.create(SYNC_ALARM_NAME, {
        periodInMinutes: SYNC_INTERVAL_MINUTES,
      });
    }

    void refreshBadge();
    void sync();
  })();
  setBackgroundStorageReadiness(readyPromise);

  // Report startup failure without replacing the rejected readiness promise.
  void readyPromise.catch((error) => {
    console.error('Failed to initialize background:', error);
  });

  registerService(BACKGROUND_SERVICE_KEY, createBackgroundService(readyPromise));
  watchGistConnectionChanges(readyPromise);
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

    await Promise.all([alarm.name === SYNC_ALARM_NAME && sync(), refreshBadge()]);
  });
}
