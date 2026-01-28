import {
  addCard,
  getAllCards,
  removeCard,
  delayCard,
  setPauseStatus,
  rateCard,
  getReviewQueue,
} from '@/services/cards';
import { getTodayStats, getCardStateStats, getAllStats, getLastNDaysStats, getNextNDaysStats } from '@/services/stats';
import { getNote, saveNote, deleteNote } from '@/services/notes';
import {
  getMaxNewCardsPerDay,
  setMaxNewCardsPerDay,
  getDayStartHour,
  setDayStartHour,
  getAnimationsEnabled,
  setAnimationsEnabled,
  getTheme,
  setTheme,
  getAutoClearLeetcode,
  setAutoClearLeetcode,
} from '@/services/settings';
import { browser } from 'wxt/browser';
import { MessageType, type MessageRequest } from '@/shared/messages';
import { runMigrations, migrations } from '@/services/migrations';
import { exportData, importData, resetAllData } from '@/services/import-export';
import {
  getGistSyncConfig,
  setGistSyncConfig,
  getGistSyncStatus,
  triggerGistSync,
  createNewGist,
  validatePat,
  validateGistId,
} from '@/services/github-sync';
import { markDataUpdated } from '@/services/data-tracker';

const SYNC_ALARM_NAME = 'gist-sync';
const SYNC_INTERVAL_MINUTES = 1;

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
  })();

  // Register alarm listener synchronously at top level (required for MV3 service workers)
  // The listener awaits readyPromise internally before proceeding
  browser.alarms.onAlarm.addListener(async (alarm) => {
    if (alarm.name !== SYNC_ALARM_NAME) return;

    // Wait for initialization before handling
    await readyPromise;

    const config = await getGistSyncConfig();
    if (config.enabled && config.pat && config.gistId) {
      await triggerGistSync();
    }
  });

  async function handleMessage(request: MessageRequest) {
    // Wait for initialization before handling any messages
    await readyPromise;

    const handleDataUpdate = async <T>(handler: () => Promise<T>): Promise<T> => {
      const result = await handler();
      await markDataUpdated();
      return result;
    };

    switch (request.type) {
      case MessageType.PING:
        return 'PONG' as const;

      case MessageType.ADD_CARD: {
        return handleDataUpdate(() => addCard(request.slug, request.name, request.leetcodeId, request.difficulty));
      }

      case MessageType.GET_ALL_CARDS:
        return await getAllCards();

      case MessageType.REMOVE_CARD: {
        return handleDataUpdate(() => removeCard(request.slug));
      }

      case MessageType.DELAY_CARD: {
        return handleDataUpdate(() => delayCard(request.slug, request.days));
      }

      case MessageType.SET_PAUSE_STATUS: {
        return handleDataUpdate(() => setPauseStatus(request.slug, request.paused));
      }

      case MessageType.RATE_CARD: {
        return handleDataUpdate(() =>
          rateCard(request.slug, request.name, request.rating, request.leetcodeId, request.difficulty)
        );
      }

      case MessageType.GET_REVIEW_QUEUE:
        return await getReviewQueue();

      case MessageType.GET_TODAY_STATS:
        return await getTodayStats();

      case MessageType.GET_NOTE:
        return await getNote(request.cardId);

      case MessageType.SAVE_NOTE: {
        return handleDataUpdate(() => saveNote(request.cardId, request.text));
      }

      case MessageType.DELETE_NOTE: {
        return handleDataUpdate(() => deleteNote(request.cardId));
      }

      case MessageType.GET_MAX_NEW_CARDS_PER_DAY:
        return await getMaxNewCardsPerDay();

      case MessageType.SET_MAX_NEW_CARDS_PER_DAY: {
        return handleDataUpdate(() => setMaxNewCardsPerDay(request.value));
      }

      case MessageType.GET_DAY_START_HOUR:
        return await getDayStartHour();

      case MessageType.SET_DAY_START_HOUR: {
        return handleDataUpdate(() => setDayStartHour(request.value));
      }

      case MessageType.GET_ANIMATIONS_ENABLED:
        return await getAnimationsEnabled();

      case MessageType.SET_ANIMATIONS_ENABLED: {
        return handleDataUpdate(() => setAnimationsEnabled(request.value));
      }

      case MessageType.GET_THEME:
        return await getTheme();

      case MessageType.SET_THEME: {
        return handleDataUpdate(() => setTheme(request.value));
      }

      case MessageType.GET_AUTO_CLEAR_LEETCODE:
        return await getAutoClearLeetcode();

      case MessageType.SET_AUTO_CLEAR_LEETCODE: {
        return handleDataUpdate(() => setAutoClearLeetcode(request.value));
      }

      case MessageType.GET_AUTO_CLEAR_LEETCODE:
        return await getAutoClearLeetcode();

      case MessageType.SET_AUTO_CLEAR_LEETCODE: {
        const result = await setAutoClearLeetcode(request.value);
        await markDataUpdated();
        return result;
      }

      case MessageType.GET_CARD_STATE_STATS:
        return await getCardStateStats();

      case MessageType.GET_ALL_STATS:
        return await getAllStats();

      case MessageType.GET_LAST_N_DAYS_STATS:
        return await getLastNDaysStats(request.days);

      case MessageType.GET_NEXT_N_DAYS_STATS:
        return await getNextNDaysStats(request.days);

      case MessageType.EXPORT_DATA:
        return await exportData();

      case MessageType.IMPORT_DATA:
        return await importData(request.jsonData);

      case MessageType.RESET_ALL_DATA:
        return await resetAllData();

      // GitHub Gist Sync
      case MessageType.GET_GIST_SYNC_CONFIG:
        return await getGistSyncConfig();

      case MessageType.SET_GIST_SYNC_CONFIG:
        return await setGistSyncConfig(request.config);

      case MessageType.GET_GIST_SYNC_STATUS:
        return await getGistSyncStatus();

      case MessageType.TRIGGER_GIST_SYNC:
        return await triggerGistSync();

      case MessageType.CREATE_NEW_GIST:
        return await createNewGist();

      case MessageType.VALIDATE_PAT:
        return await validatePat(request.pat);

      case MessageType.VALIDATE_GIST_ID:
        return await validateGistId(request.gistId, request.pat);

      default: {
        // Exhaustive check - compile error if a message type is not handled
        const _: never = request;
        throw new Error(`Unknown message type: ${(request as { type?: string }).type}`);
      }
    }
  }

  // Message handler for popup communication
  browser.runtime.onMessage.addListener((request: MessageRequest, sender, sendResponse) => {
    handleMessage(request).then(sendResponse);

    // Return true to indicate we'll send a response asynchronously
    return true;
  });
});
