import { sendMessage } from '@/infrastructure/browser/messages';
import { getCurrentDomain, getCurrentProblemSlug } from './page-context';
import { resetLeetcodeEditor } from './reset-leetcode-editor';

const SLUG_CHECK_INTERVAL_MS = 1000;

export function setupLeetcodeAutoReset(onResetConfirmed: () => void): () => void {
  let lastSlug: string | null = null;
  let lastResetSlug: string | null = null;
  let isResetting = false;
  let lastAttemptAt: number | null = null;

  const checkForNavigation = () => {
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

    if (slug === lastResetSlug) return;

    if (lastAttemptAt !== null && now - lastAttemptAt < SLUG_CHECK_INTERVAL_MS) {
      return;
    }

    lastAttemptAt = now;
    void tryAutoReset(slug);
  };

  const tryAutoReset = async (slug: string) => {
    if (isResetting) {
      return;
    }

    isResetting = true;
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

  checkForNavigation();

  const observer = new MutationObserver(checkForNavigation);
  observer.observe(document.body, { childList: true, subtree: true });

  window.addEventListener('popstate', checkForNavigation);
  const intervalId = window.setInterval(checkForNavigation, SLUG_CHECK_INTERVAL_MS);

  return () => {
    observer.disconnect();
    window.removeEventListener('popstate', checkForNavigation);
    window.clearInterval(intervalId);
  };
}
