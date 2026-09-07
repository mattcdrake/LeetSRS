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
  portals.className =
    'pointer-events-none fixed inset-0 m-0 size-full overflow-visible border-0 bg-transparent p-0 text-inherit backdrop:hidden [&>*]:pointer-events-auto';
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
