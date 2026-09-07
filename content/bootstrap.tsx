import { createRoot } from 'react-dom/client';
import { setupLeetcodeAutoReset } from './auto-reset';
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
    root.render(<LeetSrsControl />);

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
