import { addCard, getAllCards } from '@/services/cards';
import { browser } from 'wxt/browser';
import { MessageType, type MessageRequest } from '@/services/messages';

export default defineBackground(() => {
  // Message handler for popup communication
  browser.runtime.onMessage.addListener(async (request: MessageRequest) => {
    switch (request.type) {
      case MessageType.ADD_CARD:
        return await addCard(request.slug, request.name);
      case MessageType.GET_ALL_CARDS:
        return await getAllCards();
      default: {
        // This should never happen with proper typing - exhaustive check
        const _: never = request;
        throw new Error('Unknown message type');
      }
    }
  });
});
