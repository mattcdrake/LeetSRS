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
    const toolbar = document.querySelector('#ide-top-btns');
    if (toolbar && mountedControl?.element.parentElement === toolbar) return;

    if (mountedControl) {
      mountedControl.root.unmount();
      mountedControl.element.remove();
      mountedControl = null;
    }

    if (!toolbar) return;

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
