import { registerService } from '@webext-core/proxy-service';
import { browser } from 'wxt/browser';
import { BADGE_ALARM_NAME, refreshBadge } from '@/background/badge';
import { resumeGithubSignIn } from '@/background/github-auth';
import { migratePatConnection } from '@/background/legacy/github-pat';
import { initializeLearningDocument } from '@/background/legacy/learning-document-startup';
import { createBackgroundService } from '@/background/service';
import { sync, watchGistConnectionChanges } from '@/background/sync';
import { BACKGROUND_SERVICE_KEY } from '@/shared/background-service';
import { learningDocumentItem, setBackgroundStorageReadiness } from '@/shared/learning-document';

const SYNC_ALARM_NAME = 'gist-sync';
const SYNC_INTERVAL_MINUTES = 1;
export function startBackground() {
  // Commands and alarms wait until learning storage is ready.
  const readyPromise = (async () => {
    await initializeLearningDocument();
    await migratePatConnection();

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
  const resumeSignIn = () => {
    void readyPromise.then(resumeGithubSignIn).catch(() => {});
  };
  // Register synchronously: permission grants can wake a suspended worker.
  browser.permissions.onAdded.addListener(resumeSignIn);
  resumeSignIn();
  learningDocumentItem.watch(() => {
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
