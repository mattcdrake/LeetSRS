import { addCard, getAllCards } from '@/services/cards';
import { browser } from 'wxt/browser';

export default defineBackground(() => {
  // Message handler for popup communication
  browser.runtime.onMessage.addListener((request, sender, sendResponse) => {
    // Handle async operations
    (async () => {
      try {
        switch (request.type) {
          case 'ADD_CARD': {
            const card = await addCard(request.slug, request.name);
            sendResponse({ success: true, card });
            break;
          }
          case 'GET_ALL_CARDS': {
            const cards = await getAllCards();
            sendResponse({ success: true, cards });
            break;
          }
          default:
            sendResponse({ success: false, error: 'Unknown message type' });
        }
      } catch (error) {
        sendResponse({ success: false, error: error instanceof Error ? error.message : 'Unknown error' });
      }
    })();

    // Return true to indicate we'll send a response asynchronously
    return true;
  });
});
