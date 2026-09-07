import { sendMessage } from '@/infrastructure/browser/messages';
import { getCurrentDomain, getCurrentProblemSlug } from './page-context';
import { resetLeetcodeEditor } from './reset-leetcode-editor';

const RESET_CHECK_INTERVAL_MS = 1000;

export function setupLeetcodeAutoReset(onResetConfirmed: () => void): () => void {
  let visit: { slug: string | null; status: 'unchecked' | 'ready' | 'handled' } = {
    slug: null,
    status: 'unchecked',
  };
  let isResetting = false;
  let disposed = false;

  const checkForAutoReset = async () => {
    const slug = getCurrentProblemSlug();
    if (slug !== visit.slug) visit = { slug, status: 'unchecked' };
    if (disposed || !slug || visit.status === 'handled' || isResetting) return;

    const currentVisit = visit;
    const isCurrent = () => !disposed && visit === currentVisit && getCurrentProblemSlug() === slug;
    isResetting = true;
    try {
      if (currentVisit.status === 'unchecked') {
        const shouldReset = await sendMessage('shouldResetEditor', { slug, domain: getCurrentDomain() });
        if (!isCurrent()) return;
        currentVisit.status = shouldReset ? 'ready' : 'handled';
        if (!shouldReset) return;
      }

      const result = await resetLeetcodeEditor(isCurrent);
      if (!isCurrent() || result === 'unavailable' || result === 'cancelled') return;

      currentVisit.status = 'handled';
      if (result === 'confirmed') onResetConfirmed();
    } catch {
      // Leave this visit eligible for a retry on the next poll.
    } finally {
      isResetting = false;
    }
  };

  void checkForAutoReset();
  const intervalId = window.setInterval(checkForAutoReset, RESET_CHECK_INTERVAL_MS);
  return () => {
    disposed = true;
    window.clearInterval(intervalId);
  };
}
