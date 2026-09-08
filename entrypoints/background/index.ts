import { browser } from 'wxt/browser';
import { markDataUpdated } from '@/infrastructure/storage/data-tracker';
import { migrations, runMigrations } from '@/infrastructure/storage/migrations';
import { getReviewQueue } from '@/services/cards';
import { getGistDestinationConfig } from '@/services/gist-setup';
import { hasGitHubCredentials } from '@/services/github-auth';
import { getSettings } from '@/services/settings';
import { messages, registerBackgroundMessages } from './message-handlers';

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

    const existingAlarm = await browser.alarms.get(SYNC_ALARM_NAME);
    if (!existingAlarm) {
      browser.alarms.create(SYNC_ALARM_NAME, {
        periodInMinutes: SYNC_INTERVAL_MINUTES,
      });
    }

    await updateBadge();
  })();

  const messageRunner = registerBackgroundMessages(messages, {
    ready: readyPromise,
    markDataUpdated,
    refreshBadge: updateBadge,
  });

  // Register synchronously during background startup so the MV3 service worker
  // is ready to receive alarms immediately.
  browser.alarms.onAlarm.addListener(async (alarm) => {
    if (alarm.name !== SYNC_ALARM_NAME) return;

    await readyPromise;

    const [config, hasCredentials] = await Promise.all([getGistDestinationConfig(), hasGitHubCredentials()]);
    if (config.enabled && hasCredentials && config.gistId) {
      await messageRunner.execute(messages.triggerGistSync, undefined);
    } else {
      await updateBadge();
    }
  });
});
