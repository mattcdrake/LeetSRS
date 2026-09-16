import type { ContentScriptContext } from 'wxt/utils/content-script-context';
import { createShadowRootUi } from 'wxt/utils/content-script-ui/shadow-root';
import { z } from 'zod';
import { resolveLearningDocumentSettings } from '@/shared/settings';
import { readLearningDocument } from '@/shared/storage';
import { setupLeetcodeEditorReset } from './editor-reset';
import { getCurrentProblemSlug } from './page-context';
import { ACCEPTED_SUBMISSION_MESSAGE } from './submission-observer';
import { LeetSrsControl } from './ui/LeetSrsControl';
import { createContentRoot } from './ui/shadow-root';
import { Toast } from './ui/Toast';
import './ui/shadow.css';

export async function bootstrapContent(ctx: ContentScriptContext) {
  await setupLeetSrsControl(ctx);
  if (ctx.isInvalid) return;
  const disposeReset = setupLeetcodeEditorReset(() => {
    void showToast(ctx, 'Code reset to default');
  });
  ctx.onInvalidated(disposeReset);
}

async function setupLeetSrsControl(ctx: ContentScriptContext) {
  let root: ReturnType<typeof createContentRoot> | undefined;
  let slug = getCurrentProblemSlug();
  let request = 0;
  let pendingOpen = false;
  let navigation = 0;
  const seen = new Set<string>();
  const acceptedSchema = z.object({
    type: z.literal(ACCEPTED_SUBMISSION_MESSAGE),
    slug: z.string(),
    submissionId: z.string().regex(/^\d+$/),
  });
  function renderControl(openRequest = 0) {
    root?.render(<LeetSrsControl key={slug} openRequest={openRequest} />);
  }
  const ui = await createShadowRootUi(ctx, {
    name: 'leetsrs-control',
    position: 'inline',
    anchor: '#ide-top-btns',
    append: (toolbar, host) => toolbar.insertBefore(host, toolbar.lastElementChild),
    onMount(container) {
      root = createContentRoot(container);
      renderControl(pendingOpen ? ++request : 0);
      pendingOpen = false;
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
    const nextSlug = getCurrentProblemSlug();
    if (nextSlug !== slug) {
      slug = nextSlug;
      navigation++;
      pendingOpen = false;
      renderControl();
    }
    const toolbar = document.querySelector('#ide-top-btns');
    if (toolbar && ui.mounted && ui.shadowHost.parentElement === toolbar) return;
    if (ui.mounted) ui.remove();
    if (toolbar) ui.mount();
  }

  ctx.addEventListener(window, 'message', (event) => {
    if (event.source !== window || event.origin !== window.location.origin) return;
    const submission = acceptedSchema.safeParse(event.data);
    if (
      !submission.success ||
      submission.data.slug !== getCurrentProblemSlug() ||
      seen.has(submission.data.submissionId)
    )
      return;
    seen.add(submission.data.submissionId);
    mountControl();
    const startedNavigation = navigation;
    void readLearningDocument()
      .then((document) => {
        if (ctx.isInvalid || startedNavigation !== navigation || submission.data.slug !== getCurrentProblemSlug())
          return;
        if (!resolveLearningDocumentSettings(document).openRatingAfterSolving) return;
        if (root) renderControl(++request);
        else pendingOpen = true;
      })
      .catch((error: unknown) => console.error('Could not open rating panel:', error));
  });
  ctx.addEventListener(window, 'wxt:locationchange', mountControl);
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
