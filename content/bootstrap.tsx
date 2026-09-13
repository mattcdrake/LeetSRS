import type { ContentScriptContext } from 'wxt/utils/content-script-context';
import { createShadowRootUi } from 'wxt/utils/content-script-ui/shadow-root';
import { type ArrivalRefreshState, watchArrivalRefresh } from '@/ui/useArrivalRefresh';
import { setupLeetcodeAutoReset } from './auto-reset';
import { LeetSrsControl } from './ui/LeetSrsControl';
import { createContentRoot } from './ui/shadow-root';
import { Toast } from './ui/Toast';
import './ui/shadow.css';

export async function bootstrapContent(ctx: ContentScriptContext) {
  const showRefresh = await setupLeetSrsControl(ctx);
  if (ctx.isInvalid || !showRefresh) return;
  ctx.onInvalidated(watchArrivalRefresh(showRefresh, true));
  const disposeReset = setupLeetcodeAutoReset(() => {
    void showResetToast(ctx);
  });
  ctx.onInvalidated(disposeReset);
}

async function setupLeetSrsControl(ctx: ContentScriptContext) {
  let refresh: ArrivalRefreshState = { pending: true, notice: null };
  let root: ReturnType<typeof createContentRoot> | undefined;
  const ui = await createShadowRootUi(ctx, {
    name: 'leetsrs-control',
    position: 'inline',
    anchor: '#ide-top-btns',
    append: (toolbar, host) => toolbar.insertBefore(host, toolbar.lastElementChild),
    onMount(container) {
      root = createContentRoot(container);
      root.render(<LeetSrsControl refresh={refresh} />);
      return root;
    },
    onRemove: (mountedRoot) => {
      mountedRoot?.unmount();
      root = undefined;
    },
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
  return (state: ArrivalRefreshState) => {
    refresh = state;
    root?.render(<LeetSrsControl refresh={refresh} />);
  };
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
