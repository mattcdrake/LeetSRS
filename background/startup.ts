import { browser } from 'wxt/browser';
import { storage } from '#imports';
import { BADGE_ALARM_NAME, refreshBadge } from '@/background/badge';
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
import {
  connectGist,
  getSyncStatus,
  resetAllData,
  restoreBackup,
  setSyncEnabled,
  sync,
  watchGistConnectionChanges,
} from '@/background/persistence';
import { getProblemBySlug, initializeCatalog } from '@/shared/catalog';
import { messagePayloadSchemas, onMessage } from '@/shared/messages';
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

  onMessage('waitForInitialization', async ({ data }) => {
    await readyPromise;
    messagePayloadSchemas.waitForInitialization.parse(data);
    return undefined;
  });
  onMessage('getProblem', async ({ data }) => {
    await readyPromise;
    const { slug, domain } = messagePayloadSchemas.getProblem.parse(data);
    const problem = await getProblemBySlug(slug, domain);
    if (!problem) throw new Error(`Unknown problem: ${slug} on ${domain}`);
    return problem;
  });
  onMessage('addCard', async ({ data }) => {
    await readyPromise;
    return addCard(messagePayloadSchemas.addCard.parse(data).problem);
  });
  onMessage('removeCard', async ({ data }) => {
    await readyPromise;
    return removeCard(messagePayloadSchemas.removeCard.parse(data).frontendId);
  });
  onMessage('delayCard', async ({ data }) => {
    await readyPromise;
    const payload = messagePayloadSchemas.delayCard.parse(data);
    return delayCard(payload.frontendId, payload.days);
  });
  onMessage('setPauseStatus', async ({ data }) => {
    await readyPromise;
    const payload = messagePayloadSchemas.setPauseStatus.parse(data);
    return setPauseStatus(payload.frontendId, payload.paused);
  });
  onMessage('rateCard', async ({ data }) => {
    await readyPromise;
    return rateCard(messagePayloadSchemas.rateCard.parse(data).input);
  });
  onMessage('saveNote', async ({ data }) => {
    await readyPromise;
    const payload = messagePayloadSchemas.saveNote.parse(data);
    return saveNote(payload.frontendId, payload.text);
  });
  onMessage('updateSettings', async ({ data }) => {
    await readyPromise;
    return updateSettings(messagePayloadSchemas.updateSettings.parse(data).changes);
  });
  onMessage('importData', async ({ data }) => {
    await readyPromise;
    return restoreBackup(messagePayloadSchemas.importData.parse(data).jsonData);
  });
  onMessage('resetAllData', async ({ data }) => {
    await readyPromise;
    messagePayloadSchemas.resetAllData.parse(data);
    return resetAllData();
  });
  onMessage('setupGistSync', async ({ data }) => {
    await readyPromise;
    return connectGist(messagePayloadSchemas.setupGistSync.parse(data));
  });
  onMessage('setGistSyncEnabled', async ({ data }) => {
    await readyPromise;
    return setSyncEnabled(messagePayloadSchemas.setGistSyncEnabled.parse(data).enabled);
  });
  onMessage('getGistSyncStatus', async ({ data }) => {
    await readyPromise;
    messagePayloadSchemas.getGistSyncStatus.parse(data);
    return getSyncStatus();
  });
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
