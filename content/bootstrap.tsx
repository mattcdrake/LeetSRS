import type { ContentScriptContext } from 'wxt/utils/content-script-context';
import { createShadowRootUi } from 'wxt/utils/content-script-ui/shadow-root';
import { sendMessage } from '@/infrastructure/browser/messages';
import { setupLeetcodeAutoReset } from './auto-reset';
import { LeetSrsControl } from './ui/LeetSrsControl';
import { createContentRoot } from './ui/shadow-root';
import { Toast } from './ui/Toast';
import './ui/shadow.css';

export async function bootstrapContent(ctx: ContentScriptContext) {
  await setupLeetSrsControl(ctx);
  if (ctx.isInvalid) return;
  let refreshing = false;
  async function refresh() {
    if (refreshing || ctx.isInvalid) return;
    refreshing = true;
    try {
      const result = await sendMessage('refreshGistOnArrival');
      if (result && !result.success) await showToast(ctx, result.error);
    } catch (error) {
      await showToast(ctx, error instanceof Error ? error.message : String(error));
    } finally {
      refreshing = false;
    }
  }
  const onReturn = () => {
    if (document.visibilityState === 'visible') void refresh();
  };
  ctx.addEventListener(document, 'visibilitychange', onReturn);
  ctx.addEventListener(window, 'focus', onReturn);
  void refresh();
  const disposeReset = setupLeetcodeAutoReset(() => {
    void showToast(ctx, 'Code reset to default');
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

async function showToast(ctx: ContentScriptContext, message: string) {
  if (ctx.isInvalid) return;
  const ui = await createShadowRootUi(ctx, {
    name: 'leetsrs-toast',
    position: 'inline',
    anchor: 'body',
    onMount(container) {
      const root = createContentRoot(container);
      root.render(<Toast message={message} onDismiss={() => ui.remove()} />);
      return root;
    },
    onRemove: (root) => root?.unmount(),
  });
  if (ctx.isValid) ui.mount();
}
