import { MessageType, sendMessage } from '@/shared/messages';

const RESET_CONFIRM_TIMEOUT_MS = 2000;
const RESET_CONFIRM_POLL_MS = 50;
const RESET_TOAST_DURATION_MS = 2500;
const SLUG_CHECK_INTERVAL_MS = 1000;

export function setupLeetcodeAutoReset(): void {
  let lastSlug: string | null = null;
  let lastResetSlug: string | null = null;
  let isResetting = false;
  let lastAttemptedSlug: string | null = null;
  let lastAttemptAt = 0;

  const checkForNavigation = () => {
    const slug = getCurrentTitleSlug();
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

      resetButton.click();
      const confirmed = await waitForConfirmClick();
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
  window.setInterval(checkForNavigation, SLUG_CHECK_INTERVAL_MS);
}

function getCurrentTitleSlug(): string | null {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const nextRouter = (window as any).next?.router;
  if (nextRouter?.query?.slug) {
    return nextRouter.query.slug;
  }

  const match = window.location.pathname.match(/\/problems\/([^/]+)/);
  return match ? match[1] : null;
}

function waitForConfirmClick(): Promise<boolean> {
  return new Promise((resolve) => {
    const existing = findConfirmButton();
    if (existing) {
      existing.click();
      resolve(true);
      return;
    }

    const start = Date.now();
    const interval = window.setInterval(() => {
      const button = findConfirmButton();
      if (button) {
        button.click();
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

function findResetButton(): HTMLButtonElement | null {
  const icon = document.querySelector("svg[data-icon='arrow-rotate-left']");
  const button = icon?.closest('button');
  return button instanceof HTMLButtonElement ? button : null;
}

function findConfirmButton(): HTMLButtonElement | null {
  const buttons = document.querySelectorAll('button');
  for (const button of buttons) {
    if (button.textContent?.trim() === 'Confirm') {
      return button instanceof HTMLButtonElement ? button : null;
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
