import type { ContentScriptContext } from 'wxt/utils/content-script-context';
import { createShadowRootUi } from 'wxt/utils/content-script-ui/shadow-root';
import { setupLeetcodeAutoReset } from './auto-reset';
import { LeetSrsControl } from './ui/LeetSrsControl';
import { createContentRoot } from './ui/shadow-root';
import { Toast } from './ui/Toast';
import './ui/shadow.css';

export async function bootstrapContent(ctx: ContentScriptContext) {
  await setupLeetSrsControl(ctx);
  if (ctx.isInvalid) return;
  const disposeReset = setupLeetcodeAutoReset(() => {
    void showResetToast(ctx);
  });
  ctx.onInvalidated(disposeReset);
}

async function setupLeetSrsControl(ctx: ContentScriptContext) {
  const ui = await createShadowRootUi(ctx, {
    name: 'leetsrs-control',
    position: 'inline',
    anchor: '#ide-top-btns',
    append: (toolbar, host) => toolbar.insertBefore(host, toolbar.lastElementChild),
    onMount(container) {
      const root = createContentRoot(container);
      root.render(<LeetSrsControl />);
      return root;
    },
    onRemove: (root) => root?.unmount(),
  });
  ui.shadowHost.id = 'leetsrs-control';
  if (ctx.isInvalid) return;

  function mountControl() {
    const toolbar = document.querySelector('#ide-top-btns');
    if (toolbar && ui.mounted && ui.shadowHost.parentElement === toolbar) return;
    if (ui.mounted) ui.remove();
    if (toolbar) ui.mount();
  }

  mountControl();
  const observer = new MutationObserver(mountControl);
  observer.observe(document.body, { childList: true, subtree: true });
  ctx.onInvalidated(() => observer.disconnect());
}

async function showResetToast(ctx: ContentScriptContext) {
  const ui = await createShadowRootUi(ctx, {
    name: 'leetsrs-toast',
    position: 'inline',
    anchor: 'body',
    onMount(container) {
      const root = createContentRoot(container);
      root.render(<Toast message="Code reset to default" onDismiss={() => ui.remove()} />);
      return root;
    },
    onRemove: (root) => root?.unmount(),
  });
  if (ctx.isValid) ui.mount();
}
