const RESET_CONFIRM_TIMEOUT_MS = 2000;
const RESET_CONFIRM_POLL_MS = 50;

// LeetCode inlines FontAwesome icons. Current markup only carries the icon name
// in the class list; older markup also set data-icon.
const RESET_ICON_SELECTOR = 'svg.fa-arrow-rotate-left, svg[data-icon="arrow-rotate-left"]';
const CLICKABLE_SELECTOR = 'button, [role="button"]';
const MODAL_SELECTOR = '[role="dialog"][aria-modal="true"], [role="alertdialog"]';
// The dialog is rendered by LeetCode, so match their labels rather than ours.
const CONFIRM_LABELS = ['confirm', '确认', '确定'];

export async function resetLeetcodeEditor(
  isCurrent: () => boolean = () => true
): Promise<'unavailable' | 'confirmed' | 'confirmation-timeout' | 'cancelled'> {
  if (!isCurrent()) return 'cancelled';
  const resetButton = findResetButton();
  if (!resetButton) {
    return 'unavailable';
  }

  // Exclude dialogs that were already on the page before our reset click.
  const openModals = new Set(findModals());
  resetButton.click();
  return waitForConfirmClick(openModals, isCurrent);
}

function waitForConfirmClick(
  openModals: Set<Element>,
  isCurrent: () => boolean
): Promise<'confirmed' | 'confirmation-timeout' | 'cancelled'> {
  return new Promise((resolve) => {
    const clickConfirm = () => {
      const button = findConfirmButton(openModals);
      if (!button) {
        return false;
      }

      button.click();
      return true;
    };

    if (!isCurrent()) {
      resolve('cancelled');
      return;
    }

    if (clickConfirm()) {
      resolve('confirmed');
      return;
    }

    const start = Date.now();
    const interval = window.setInterval(() => {
      if (!isCurrent()) {
        window.clearInterval(interval);
        resolve('cancelled');
        return;
      }

      if (clickConfirm()) {
        window.clearInterval(interval);
        resolve('confirmed');
        return;
      }

      if (Date.now() - start >= RESET_CONFIRM_TIMEOUT_MS) {
        window.clearInterval(interval);
        resolve('confirmation-timeout');
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
