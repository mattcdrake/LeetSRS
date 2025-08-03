import { addCard, getAllCards } from '@/services/cards';
import { browser } from 'wxt/browser';
import { MessageType, type MessageRequest } from '@/services/messages';

export default defineBackground(() => {
  // Message handler for popup communication
  browser.runtime.onMessage.addListener((request: MessageRequest, sender, sendResponse) => {
    // Handle async operations
    (async () => {
      try {
        switch (request.type) {
          case MessageType.ADD_CARD: {
            const card = await addCard(request.slug, request.name);
            sendResponse(card);
            break;
          }
          case MessageType.GET_ALL_CARDS: {
            const cards = await getAllCards();
            sendResponse(cards);
            break;
          }
          default: {
            // This should never happen with proper typing - exhaustive check
            const _: never = request;
            throw new Error('Unknown message type');
          }
        }
      } catch (error) {
        console.error('Background script error:', error);
        sendResponse(null);
      }
    })();

    // Return true to indicate we'll send a response asynchronously
    return true;
  });
});
