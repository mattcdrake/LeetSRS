import { getCurrentProblem } from '@/content/current-problem';
import { getCurrentProblemSlug } from '@/content/page-context';
import { isDue } from '@/shared/calendar';
import { findCard } from '@/shared/models';
import { resolveLearningDocumentSettings } from '@/shared/settings';
import { readLearningDocument } from '@/shared/storage';

const CONTROL_POLL_MS = 50;
const CONTROL_TIMEOUT_MS = 10_000;
const CONFIRM_TIMEOUT_MS = 2000;
const RESET_ICON_SELECTOR = 'svg.fa-arrow-rotate-left, svg[data-icon="arrow-rotate-left"]';
const CLICKABLE_SELECTOR = 'button, [role="button"]';
const MODAL_SELECTOR = '[role="dialog"][aria-modal="true"], [role="alertdialog"]';
const CONFIRM_LABELS = ['confirm', '确认', '确定'];

export function setupLeetcodeEditorReset(onResetConfirmed: () => void): () => void {
  const problemSlug = getCurrentProblemSlug();
  if (!problemSlug) return () => {};

  const origin = window.location.origin;

  let active = true;
  let timerId: number | undefined;
  let controlStartedAt = 0;

  const isActive = () => active && window.location.origin === origin && getCurrentProblemSlug() === problemSlug;
  const finish = () => {
    active = false;
    if (timerId !== undefined) {
      window.clearTimeout(timerId);
      timerId = undefined;
    }
  };
  const schedule = (callback: () => void) => {
    timerId = window.setTimeout(callback, CONTROL_POLL_MS);
  };

  const waitForResetControl = () => {
    if (!isActive()) {
      finish();
      return;
    }

    const resetButton = findResetButton();
    if (!resetButton) {
      if (Date.now() - controlStartedAt >= CONTROL_TIMEOUT_MS) {
        finish();
        return;
      }
      schedule(waitForResetControl);
      return;
    }

    const openDialogs = new Set(findModals());
    if (!isActive()) {
      finish();
      return;
    }

    resetButton.click();
    const confirmationStartedAt = Date.now();

    const waitForConfirmation = () => {
      if (!isActive()) {
        finish();
        return;
      }

      const confirmButton = findConfirmButton(openDialogs);
      if (confirmButton) {
        if (!isActive()) {
          finish();
          return;
        }
        confirmButton.click();
        finish();
        onResetConfirmed();
        return;
      }

      if (Date.now() - confirmationStartedAt >= CONFIRM_TIMEOUT_MS) {
        finish();
        return;
      }

      schedule(waitForConfirmation);
    };

    waitForConfirmation();
  };

  async function resetIfDue() {
    const document = await readLearningDocument();
    if (!isActive() || !resolveLearningDocumentSettings(document).resetEditorOnReviewQueue) return;

    const problem = await getCurrentProblem();
    const card = findCard(document, problem.frontendId);
    if (!isActive() || !card || card.paused || !isDue(card.fsrs.due, new Date())) return;

    controlStartedAt = Date.now();
    waitForResetControl();
  }

  void resetIfDue().catch((error: unknown) => {
    finish();
    console.error('Could not reset editor:', error);
  });
  return finish;
}

function findResetButton(): HTMLElement | null {
  for (const icon of document.querySelectorAll(RESET_ICON_SELECTOR)) {
    const button = icon.closest(CLICKABLE_SELECTOR);
    if (button instanceof HTMLElement) return button;
  }
  return null;
}

function findConfirmButton(openDialogs: Set<Element>): HTMLElement | null {
  for (const modal of findModals()) {
    if (openDialogs.has(modal)) continue;

    const button = Array.from(modal.querySelectorAll('button')).find((candidate) =>
      CONFIRM_LABELS.includes(candidate.textContent?.trim().toLowerCase() ?? '')
    );
    if (button) return button;
  }
  return null;
}

function findModals(): NodeListOf<Element> {
  return document.querySelectorAll(MODAL_SELECTOR);
}
