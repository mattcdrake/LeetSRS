import { createElement } from 'react';
import { createRoot } from 'react-dom/client';
import type { Grade } from 'ts-fsrs';
import { sendMessage } from '@/infrastructure/browser/messages';
import { setupLeetcodeAutoReset } from './auto-reset';
import { getCurrentProblem } from './problem-data';
import { LeetSrsControl } from './ui/LeetSrsControl';

export function bootstrapContent() {
  setupLeetSrsButton();
  setupLeetcodeAutoReset();
}

function setupLeetSrsButton() {
  const BUTTON_ID = 'leetsrs-button-wrapper';
  let mountedButton: { element: HTMLElement; dispose: () => void } | null = null;

  function insertButton(buttonsContainer: Element) {
    if (buttonsContainer.querySelector(`#${BUTTON_ID}`)) {
      return;
    }

    const buttonWrapper = document.createElement('div');
    buttonWrapper.id = BUTTON_ID;
    const root = createRoot(buttonWrapper);
    root.render(
      createElement(LeetSrsControl, {
        onRate: async (rating, label) => {
          try {
            const problem = await getCurrentProblem();
            if (!problem) return;

            const result = await sendMessage('rateCard', {
              input: { ...problem, rating: rating as Grade },
            });
            console.log(`${label} - Card rated:`, result);
          } catch (error) {
            console.error('Error rating card:', error);
          }
        },
        onAddWithoutRating: async () => {
          try {
            const problem = await getCurrentProblem();
            if (!problem) return;

            const result = await sendMessage('addCard', { problem });
            console.log('Add without rating - Card added:', result);
          } catch (error) {
            console.error('Error adding card:', error);
          }
        },
      })
    );

    mountedButton = {
      element: buttonWrapper,
      dispose: () => {
        root.unmount();
        buttonWrapper.remove();
      },
    };

    const lastButtonGroup = buttonsContainer.lastElementChild;

    try {
      buttonsContainer.insertBefore(buttonWrapper, lastButtonGroup);
    } catch (error) {
      mountedButton?.dispose();
      mountedButton = null;
      console.error('Error adding LeetSRS button:', error);
    }
  }

  const tryInsertButton = () => {
    if (mountedButton && !mountedButton.element.isConnected) {
      mountedButton.dispose();
      mountedButton = null;
    }
    const buttonsContainer = document.querySelector('#ide-top-btns');
    if (buttonsContainer) {
      insertButton(buttonsContainer);
    }
  };
  tryInsertButton();

  // Use MutationObserver to handle SPA navigation and React re-renders.
  const observer = new MutationObserver(tryInsertButton);
  observer.observe(document.body, {
    childList: true,
    subtree: true,
  });
}
