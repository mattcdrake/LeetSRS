import { MessageType, sendMessage } from '@/shared/messages';
import { getCurrentProblemSlug } from './domain';

const RESET_CONFIRM_TIMEOUT_MS = 2000;
const RESET_CONFIRM_POLL_MS = 50;
const RESET_TOAST_DURATION_MS = 2500;
const SLUG_CHECK_INTERVAL_MS = 1000;

// LeetCode inlines FontAwesome icons. Current markup only carries the icon name
// in the class list; older markup also set data-icon.
const RESET_ICON_SELECTOR = 'svg.fa-arrow-rotate-left, svg[data-icon="arrow-rotate-left"]';
const CLICKABLE_SELECTOR = 'button, [role="button"]';
const MODAL_SELECTOR = '[role="dialog"][aria-modal="true"], [role="alertdialog"]';
// The dialog is rendered by LeetCode, so match their labels rather than ours.
const CONFIRM_LABELS = ['confirm', '确认', '确定'];

/**
 * Watches for problem navigation and resets the editor to the default code.
 * Returns a disposer that stops watching.
 */
export function setupLeetcodeAutoReset(): () => void {
  let lastSlug: string | null = null;
  let lastResetSlug: string | null = null;
  let isResetting = false;
  let lastAttemptedSlug: string | null = null;
  let lastAttemptAt = 0;

  const checkForNavigation = () => {
    const slug = getCurrentProblemSlug();
    if (!slug) {
      lastSlug = null;
      return;
    }

    const now = Date.now();
    if (slug !== lastSlug) {
      lastSlug = slug;
      lastAttemptedSlug = null;
      lastAttemptAt = 0;
    }

    if (slug !== lastResetSlug) {
      if (lastAttemptedSlug === slug && now - lastAttemptAt < SLUG_CHECK_INTERVAL_MS) {
        return;
      }

      lastAttemptedSlug = slug;
      lastAttemptAt = now;
      void tryAutoReset(slug);
    }
  };

  const tryAutoReset = async (slug: string) => {
    if (isResetting || slug === lastResetSlug) {
      return;
    }

    isResetting = true;
    try {
      const autoClearEnabled = await sendMessage({ type: MessageType.GET_AUTO_CLEAR_LEETCODE });
      if (!autoClearEnabled) {
        return;
      }

      const resetButton = findResetButton();
      if (!resetButton) {
        return;
      }

      // Snapshot the dialogs already on the page so we only ever confirm the one
      // our own click opens.
      const openModals = new Set(findModals());
      resetButton.click();
      const confirmed = await waitForConfirmClick(openModals);
      if (confirmed) {
        showToast('Code reset to default');
      }
      lastResetSlug = slug;
    } catch (error) {
      console.error('Failed to auto reset LeetCode editor:', error);
    } finally {
      isResetting = false;
    }
  };

  checkForNavigation();

  const observer = new MutationObserver(() => {
    checkForNavigation();
  });
  observer.observe(document.body, { childList: true, subtree: true });

  window.addEventListener('popstate', checkForNavigation);
  const intervalId = window.setInterval(checkForNavigation, SLUG_CHECK_INTERVAL_MS);

  return () => {
    observer.disconnect();
    window.removeEventListener('popstate', checkForNavigation);
    window.clearInterval(intervalId);
  };
}

function waitForConfirmClick(openModals: Set<Element>): Promise<boolean> {
  return new Promise((resolve) => {
    const clickConfirm = () => {
      const button = findConfirmButton(openModals);
      if (!button) {
        return false;
      }

      button.click();
      return true;
    };

    if (clickConfirm()) {
      resolve(true);
      return;
    }

    const start = Date.now();
    const interval = window.setInterval(() => {
      if (clickConfirm()) {
        window.clearInterval(interval);
        resolve(true);
        return;
      }

      if (Date.now() - start >= RESET_CONFIRM_TIMEOUT_MS) {
        window.clearInterval(interval);
        resolve(false);
      }
    }, RESET_CONFIRM_POLL_MS);
  });
}

function findResetButton(): HTMLElement | null {
  for (const icon of document.querySelectorAll(RESET_ICON_SELECTOR)) {
    const button = icon.closest(CLICKABLE_SELECTOR);
    if (button instanceof HTMLElement) {
      return button;
    }
  }
  return null;
}

function findModals(): HTMLElement[] {
  return Array.from(document.querySelectorAll<HTMLElement>(MODAL_SELECTOR));
}

function findConfirmButton(openModals: Set<Element>): HTMLElement | null {
  for (const modal of findModals()) {
    if (openModals.has(modal)) {
      continue;
    }

    const buttons = Array.from(modal.querySelectorAll('button'));
    const labelled = buttons.find((button) => CONFIRM_LABELS.includes(button.textContent?.trim().toLowerCase() ?? ''));
    if (labelled) {
      return labelled;
    }

    // Unknown locale: the dialog is a plain cancel/confirm pair, confirm last.
    if (buttons.length === 2) {
      return buttons[1];
    }
  }
  return null;
}

function showToast(message: string): void {
  const toast = document.createElement('div');
  toast.textContent = message;
  Object.assign(toast.style, {
    position: 'fixed',
    bottom: '20px',
    right: '20px',
    background: '#323232',
    color: '#fff',
    padding: '12px 16px',
    borderRadius: '8px',
    fontSize: '14px',
    boxShadow: '0 2px 8px rgba(0,0,0,0.2)',
    zIndex: '9999',
    opacity: '0',
    transition: 'opacity 0.3s ease-in-out',
  } as Partial<CSSStyleDeclaration>);

  document.body.appendChild(toast);

  requestAnimationFrame(() => {
    toast.style.opacity = '1';
  });

  window.setTimeout(() => {
    toast.style.opacity = '0';
    window.setTimeout(() => toast.remove(), 300);
  }, RESET_TOAST_DURATION_MS);
}
