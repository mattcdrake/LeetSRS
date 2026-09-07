import { sendMessage } from '@/infrastructure/browser/messages';
import { getCurrentDomain, getCurrentProblemSlug } from './page-context';
import { resetLeetcodeEditor } from './reset-leetcode-editor';

const SLUG_CHECK_INTERVAL_MS = 1000;

export function setupLeetcodeAutoReset(onResetConfirmed: () => void): () => void {
  let lastSlug: string | null = null;
  let lastResetSlug: string | null = null;
  let isResetting = false;
  let lastAttemptAt: number | null = null;

  const checkForAutoReset = () => {
    const slug = getCurrentProblemSlug();
    if (!slug) {
      lastSlug = null;
      return;
    }

    const now = Date.now();
    if (slug !== lastSlug) {
      lastSlug = slug;
      lastAttemptAt = null;
    }

    if (isResetting || slug === lastResetSlug) return;

    if (lastAttemptAt !== null && now - lastAttemptAt < SLUG_CHECK_INTERVAL_MS) {
      return;
    }

    lastAttemptAt = now;
    isResetting = true;
    void performAutoReset(slug);
  };

  const performAutoReset = async (slug: string) => {
    try {
      const shouldReset = await sendMessage('shouldResetEditor', {
        slug,
        domain: getCurrentDomain(),
      });
      if (!shouldReset) {
        return;
      }

      const result = await resetLeetcodeEditor();
      if (result === 'unavailable') {
        return;
      }

      if (result === 'confirmed') {
        onResetConfirmed();
      }
      lastResetSlug = slug;
    } catch {
      // Leave this slug eligible for a retry on the next check.
    } finally {
      isResetting = false;
    }
  };

  checkForAutoReset();

  const observer = new MutationObserver(checkForAutoReset);
  observer.observe(document.body, { childList: true, subtree: true });

  window.addEventListener('popstate', checkForAutoReset);
  const intervalId = window.setInterval(checkForAutoReset, SLUG_CHECK_INTERVAL_MS);

  return () => {
    observer.disconnect();
    window.removeEventListener('popstate', checkForAutoReset);
    window.clearInterval(intervalId);
  };
}
