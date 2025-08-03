import { addCard, getAllCards, removeCard, rateCard, getReviewQueue } from '@/services/cards';
import { getTodayStats } from '@/services/stats';
import { browser } from 'wxt/browser';
import { MessageType, type MessageRequest } from '@/services/messages';

export default defineBackground(() => {
  async function handleMessage(request: MessageRequest) {
    switch (request.type) {
      case MessageType.ADD_CARD:
        return await addCard(request.slug, request.name);

      case MessageType.GET_ALL_CARDS:
        return await getAllCards();

      case MessageType.REMOVE_CARD:
        return await removeCard(request.slug);

      case MessageType.RATE_CARD:
        return await rateCard(request.slug, request.rating);

      case MessageType.GET_REVIEW_QUEUE:
        return await getReviewQueue();

      case MessageType.GET_TODAY_STATS:
        return await getTodayStats();

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
