import { createRoot, type Root } from 'react-dom/client';
import { setupLeetcodeAutoReset } from './auto-reset';
import { LeetSrsControl } from './ui/LeetSrsControl';

export function bootstrapContent() {
  setupLeetSrsControl();
  setupLeetcodeAutoReset();
}

function setupLeetSrsControl() {
  const CONTROL_ID = 'leetsrs-control';
  let mountedControl: { element: HTMLElement; root: Root } | null = null;

  function mountControl() {
    if (mountedControl && !mountedControl.element.isConnected) {
      mountedControl.root.unmount();
      mountedControl = null;
    }

    const toolbar = document.querySelector('#ide-top-btns');
    if (!toolbar || toolbar.querySelector(`#${CONTROL_ID}`)) return;

    const container = document.createElement('div');
    container.id = CONTROL_ID;
    toolbar.insertBefore(container, toolbar.lastElementChild);
    const root = createRoot(container);
    root.render(<LeetSrsControl />);

    mountedControl = { element: container, root };
  }

  mountControl();

  const observer = new MutationObserver(mountControl);
  observer.observe(document.body, {
    childList: true,
    subtree: true,
  });
}
