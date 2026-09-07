import type { ReactNode } from 'react';
import { UNSAFE_PortalProvider } from 'react-aria/PortalProvider';
import { createRoot } from 'react-dom/client';
import { enableShadowDOM } from 'react-stately/private/flags/flags';

export function createContentRoot(uiContainer: HTMLElement) {
  // React Aria must follow focus and event targets across the shadow boundary.
  enableShadowDOM();
  const container = document.createElement('div');
  const portals = document.createElement('div');

  // The top layer prevents toolbar overflow from clipping portalled surfaces.
  portals.className = 'leetsrs-portals';
  portals.setAttribute('popover', 'manual');
  uiContainer.append(container, portals);
  portals.showPopover?.();
  const root = createRoot(container);

  return {
    render(children: ReactNode) {
      root.render(<UNSAFE_PortalProvider getContainer={() => portals}>{children}</UNSAFE_PortalProvider>);
    },
    unmount() {
      root.unmount();
    },
  };
}
