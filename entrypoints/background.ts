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
  getAnimationsEnabled,
  setAnimationsEnabled,
  getTheme,
  setTheme,
  getEnableLeetCodeButton,
  setEnableLeetCodeButton,
} from '@/services/settings';
import { browser } from 'wxt/browser';
import { MessageType, type MessageRequest } from '@/shared/messages';
import { runMigrations, migrations } from '@/services/migrations';
import { exportData, importData, resetAllData } from '@/services/import-export';

export default defineBackground(async () => {
  // Run migrations on startup
  await runMigrations(migrations).catch((error) => {
    console.error('Failed to run migrations:', error);
  });

  async function handleMessage(request: MessageRequest) {
    switch (request.type) {
      case MessageType.ADD_CARD:
        return await addCard(request.slug, request.name, request.leetcodeId, request.difficulty);

      case MessageType.GET_ALL_CARDS:
        return await getAllCards();

      case MessageType.REMOVE_CARD:
        return await removeCard(request.slug);

      case MessageType.DELAY_CARD:
        return await delayCard(request.slug, request.days);

      case MessageType.SET_PAUSE_STATUS:
        return await setPauseStatus(request.slug, request.paused);

      case MessageType.RATE_CARD:
        return await rateCard(request.slug, request.name, request.rating, request.leetcodeId, request.difficulty);

      case MessageType.GET_REVIEW_QUEUE:
        return await getReviewQueue();

      case MessageType.GET_TODAY_STATS:
        return await getTodayStats();

      case MessageType.GET_NOTE:
        return await getNote(request.cardId);

      case MessageType.SAVE_NOTE:
        return await saveNote(request.cardId, request.text);

      case MessageType.DELETE_NOTE:
        return await deleteNote(request.cardId);

      case MessageType.GET_MAX_NEW_CARDS_PER_DAY:
        return await getMaxNewCardsPerDay();

      case MessageType.SET_MAX_NEW_CARDS_PER_DAY:
        return await setMaxNewCardsPerDay(request.value);

      case MessageType.GET_ANIMATIONS_ENABLED:
        return await getAnimationsEnabled();

      case MessageType.SET_ANIMATIONS_ENABLED:
        return await setAnimationsEnabled(request.value);

      case MessageType.GET_THEME:
        return await getTheme();

      case MessageType.SET_THEME:
        return await setTheme(request.value);

      case MessageType.GET_ENABLE_LEETCODE_BUTTON:
        return await getEnableLeetCodeButton();

      case MessageType.SET_ENABLE_LEETCODE_BUTTON:
        return await setEnableLeetCodeButton(request.value);

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

      default: {
        // This should never happen with proper typing - exhaustive check
        const _: never = request;
        throw new Error('Unknown message type');
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
