import { MessageType, sendMessage } from '@/shared/messages';
import { getCurrentDomain } from './domain';

const NAVIGATION_EVENT = 'leetsrs:navigation';
const RESET_ACTION_PATTERN = /^reset\s+to\s+default\s+code\s+definition$/i;
const RESET_CONFIRMATION_PATTERN = /\breset\b|\bdefault code\b/i;
export const RESET_CONFIRMATION_TIMEOUT_MS = 1_000;
const SETTINGS_CONTROL_SELECTOR = [
  '[data-cy*="editor" i][data-cy*="setting" i]',
  '[data-testid*="editor" i][data-testid*="setting" i]',
  '[aria-label*="editor settings" i]',
  '[aria-label*="code settings" i]',
  '[aria-label*="editor actions" i]',
  '[data-tooltip*="editor settings" i]',
  '[title*="editor settings" i]',
].join(', ');
const INTERACTIVE_SELECTOR = 'button, [role="button"], [role="menuitem"], [role="menuitemradio"]';

/**
 * Installs a navigation-aware reset flow for due review cards.
 *
 * LeetCode owns the editor's saved state, so this deliberately invokes its
 * reset action rather than guessing at or deleting browser storage entries.
 */
export function setupClearEditorOnReview(): () => void {
  let routeKey: string | null = null;
  let disposePendingReset: (() => void) | undefined;

  const processCurrentRoute = () => {
    const nextRouteKey = `${window.location.pathname}${window.location.search}`;
    if (nextRouteKey === routeKey) {
      return;
    }

    routeKey = nextRouteKey;
    disposePendingReset?.();
    disposePendingReset = undefined;

    const slug = getProblemSlugFromRouteKey(nextRouteKey);
    if (!slug) {
      return;
    }

    const requestedRouteKey = nextRouteKey;
    void requestDueReviewReset(slug, () => isCurrentProblemRoute(requestedRouteKey, slug)).then((dispose) => {
      if (currentRouteKey() === requestedRouteKey) {
        disposePendingReset = dispose;
      } else {
        dispose();
      }
    });
  };

  const restoreHistory = observeHistoryNavigation();
  window.addEventListener(NAVIGATION_EVENT, processCurrentRoute);
  window.addEventListener('popstate', processCurrentRoute);
  window.addEventListener('pageshow', processCurrentRoute);
  processCurrentRoute();

  return () => {
    disposePendingReset?.();
    restoreHistory();
    window.removeEventListener(NAVIGATION_EVENT, processCurrentRoute);
    window.removeEventListener('popstate', processCurrentRoute);
    window.removeEventListener('pageshow', processCurrentRoute);
  };
}

async function requestDueReviewReset(slug: string, isCurrentRoute: () => boolean): Promise<() => void> {
  try {
    const decision = await sendMessage({
      type: MessageType.GET_CLEAR_EDITOR_ON_REVIEW_DECISION,
      slug,
      domain: getCurrentDomain(),
    });

    if (!decision.shouldClear || !isCurrentRoute()) {
      return () => undefined;
    }

    return waitForEditorAndReset(isCurrentRoute);
  } catch (error) {
    console.error('Failed to reset LeetCode editor for due review:', error);
    return () => undefined;
  }
}

/** Waits for LeetCode's editor controls without polling, then resets once. */
export function waitForEditorAndReset(isCurrentRoute: () => boolean = () => true): () => void {
  let complete = false;
  let observer: MutationObserver | undefined;
  let confirmationTimeout: ReturnType<typeof setTimeout> | undefined;
  let settingsOpened = false;
  let resetRequested = false;
  let dialogsBeforeReset = new Set<HTMLElement>();

  const stop = () => {
    complete = true;
    observer?.disconnect();
    if (confirmationTimeout !== undefined) {
      clearTimeout(confirmationTimeout);
    }
  };

  const tryReset = () => {
    if (complete || !isCurrentRoute()) {
      stop();
      return;
    }

    if (resetRequested) {
      // A confirmation dialog may be rendered by React after the menu action
      // click. Keep observing mutations so it is confirmed when it appears.
      if (clickResetConfirmation(document, dialogsBeforeReset)) {
        stop();
      }
      return;
    }

    const settingsControl = findEditorSettingsControl(document);
    if (!settingsControl) {
      return;
    }

    if (!settingsOpened) {
      settingsControl.click();
      settingsOpened = true;
    }

    const resetAction = findResetToDefaultCodeDefinition(document);
    if (!resetAction) {
      return;
    }

    resetRequested = true;
    dialogsBeforeReset = new Set(findDialogs(document));
    confirmationTimeout = setTimeout(stop, RESET_CONFIRMATION_TIMEOUT_MS);
    resetAction.click();
    if (clickResetConfirmation(document, dialogsBeforeReset)) {
      stop();
    }
  };

  tryReset();
  if (!complete) {
    observer = new MutationObserver(tryReset);
    observer.observe(document.documentElement, { childList: true, subtree: true });
  }

  return stop;
}

/** Finds the editor's settings/actions control via stable semantics, not CSS classes. */
export function findEditorSettingsControl(root: ParentNode): HTMLElement | null {
  const labelledControl = Array.from(root.querySelectorAll<HTMLElement>(SETTINGS_CONTROL_SELECTOR)).find(isInteractive);
  if (labelledControl) {
    return labelledControl;
  }

  return (
    Array.from(root.querySelectorAll<HTMLElement>(INTERACTIVE_SELECTOR)).find((element) => {
      const label = accessibleLabel(element);
      return /\b(settings|actions)\b/i.test(label) && /\b(editor|code)\b/i.test(label);
    }) ?? null
  );
}

/** Finds LeetCode's English reset command once the settings menu is open. */
export function findResetToDefaultCodeDefinition(root: ParentNode): HTMLElement | null {
  return (
    Array.from(root.querySelectorAll<HTMLElement>(INTERACTIVE_SELECTOR)).find((element) => {
      return RESET_ACTION_PATTERN.test(accessibleLabel(element));
    }) ?? null
  );
}

/**
 * Confirms only a visible reset dialog created after this reset action began.
 * Existing dialogs are deliberately excluded so an unrelated destructive UI
 * cannot be acknowledged by the extension.
 */
export function clickResetConfirmation(root: ParentNode, dialogsBeforeReset: ReadonlySet<HTMLElement>): boolean {
  const dialog = findDialogs(root).find(
    (candidate) =>
      !dialogsBeforeReset.has(candidate) &&
      isVisible(candidate) &&
      RESET_CONFIRMATION_PATTERN.test(accessibleLabel(candidate))
  );
  if (!dialog) {
    return false;
  }

  const confirmation = Array.from(dialog.querySelectorAll<HTMLElement>(INTERACTIVE_SELECTOR)).find(
    (element) => isVisible(element) && /^(reset|confirm)$/i.test(accessibleLabel(element))
  );
  if (!confirmation) {
    return false;
  }

  confirmation.click();
  return true;
}

function observeHistoryNavigation(): () => void {
  const historyWithOriginals = history as History & {
    pushState: History['pushState'];
    replaceState: History['replaceState'];
  };
  const originalPushState = historyWithOriginals.pushState;
  const originalReplaceState = historyWithOriginals.replaceState;

  const dispatchNavigation = () => window.dispatchEvent(new Event(NAVIGATION_EVENT));
  historyWithOriginals.pushState = function (...args) {
    originalPushState.apply(this, args);
    dispatchNavigation();
  };
  historyWithOriginals.replaceState = function (...args) {
    originalReplaceState.apply(this, args);
    dispatchNavigation();
  };

  return () => {
    historyWithOriginals.pushState = originalPushState;
    historyWithOriginals.replaceState = originalReplaceState;
  };
}

function accessibleLabel(element: HTMLElement): string {
  return [element.getAttribute('aria-label'), element.getAttribute('title'), element.textContent]
    .filter((value): value is string => Boolean(value))
    .join(' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function isInteractive(element: HTMLElement): boolean {
  return element.matches(INTERACTIVE_SELECTOR);
}

function currentRouteKey(): string {
  return `${window.location.pathname}${window.location.search}`;
}

function getProblemSlugFromRouteKey(routeKey: string): string | null {
  const pathname = routeKey.split('?')[0];
  const pathMatch = pathname.match(/\/problems\/([^/]+)/);
  return pathMatch ? pathMatch[1] : null;
}

function isCurrentProblemRoute(routeKey: string, slug: string): boolean {
  return currentRouteKey() === routeKey && getProblemSlugFromRouteKey(currentRouteKey()) === slug;
}

function findDialogs(root: ParentNode): HTMLElement[] {
  return Array.from(root.querySelectorAll<HTMLElement>('[role="dialog"], [aria-modal="true"]'));
}

function isVisible(element: HTMLElement): boolean {
  if (!element.isConnected || element.hidden || element.getAttribute('aria-hidden') === 'true') {
    return false;
  }

  const style = window.getComputedStyle(element);
  return style.display !== 'none' && style.visibility !== 'hidden';
}
