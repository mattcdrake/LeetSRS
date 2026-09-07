import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { sendMessage } from '@/infrastructure/browser/messages';
import { requireDefined } from '@/test/utils/assertions';
import { createDeferred } from '@/test/utils/deferred';
import { setupLeetcodeAutoReset } from '../auto-reset';

// @vitest-environment happy-dom

vi.mock('@/infrastructure/browser/messages', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/infrastructure/browser/messages')>()),
  sendMessage: vi.fn(),
}));

type ResetIconMarkup = 'class' | 'data-icon';

function renderResetButton(markup: ResetIconMarkup): HTMLButtonElement {
  const icon =
    markup === 'class'
      ? '<svg class="svg-inline--fa fa-arrow-rotate-left" aria-hidden="true"><path d="M40 224c-13.3 0" /></svg>'
      : '<svg data-icon="arrow-rotate-left" aria-hidden="true"><path d="M40 224c-13.3 0" /></svg>';

  const toolbar = document.createElement('div');
  toolbar.className = 'flex h-full items-center gap-1';
  toolbar.innerHTML = `<button data-state="closed">${icon}</button>`;
  document.body.appendChild(toolbar);

  return requireDefined(toolbar.querySelector('button'));
}

function createConfirmDialog(confirmLabel: string): HTMLElement {
  const dialog = document.createElement('div');
  dialog.setAttribute('role', 'dialog');
  dialog.setAttribute('aria-modal', 'true');
  dialog.innerHTML = `<button>Cancel</button><button>${confirmLabel}</button>`;

  return dialog;
}

function attachConfirmDialog(resetButton: HTMLButtonElement, confirmLabel: string, delayMs = 0): HTMLButtonElement {
  const dialog = createConfirmDialog(confirmLabel);

  resetButton.addEventListener('click', () => {
    if (delayMs === 0) {
      document.body.appendChild(dialog);
      return;
    }
    window.setTimeout(() => document.body.appendChild(dialog), delayMs);
  });

  return dialog.querySelectorAll('button')[1] as HTMLButtonElement;
}

describe('setupLeetcodeAutoReset', () => {
  let dispose: (() => void) | undefined;
  const onResetConfirmed = vi.fn();

  beforeEach(() => {
    vi.useFakeTimers();
    vi.mocked(sendMessage).mockResolvedValue(true);
    history.pushState({}, '', '/problems/two-sum/');
  });

  afterEach(() => {
    dispose?.();
    dispose = undefined;
    document.body.innerHTML = '';
    vi.clearAllTimers();
    vi.useRealTimers();
  });

  it('should reset and confirm using the current icon markup', async () => {
    const resetButton = renderResetButton('class');
    const confirmButton = attachConfirmDialog(resetButton, 'Confirm');
    const resetClick = vi.spyOn(resetButton, 'click');
    const confirmClick = vi.spyOn(confirmButton, 'click');

    dispose = setupLeetcodeAutoReset(onResetConfirmed);
    await vi.advanceTimersByTimeAsync(0);

    expect(resetClick).toHaveBeenCalledTimes(1);
    expect(confirmClick).toHaveBeenCalledTimes(1);
  });

  it('should still find the reset button via the legacy data-icon attribute', async () => {
    const resetButton = renderResetButton('data-icon');
    const confirmButton = attachConfirmDialog(resetButton, 'Confirm');
    const confirmClick = vi.spyOn(confirmButton, 'click');

    dispose = setupLeetcodeAutoReset(onResetConfirmed);
    await vi.advanceTimersByTimeAsync(0);

    expect(confirmClick).toHaveBeenCalledTimes(1);
  });

  it('should confirm the localized dialog on leetcode.cn', async () => {
    const resetButton = renderResetButton('class');
    const confirmButton = attachConfirmDialog(resetButton, '确认');
    const confirmClick = vi.spyOn(confirmButton, 'click');

    dispose = setupLeetcodeAutoReset(onResetConfirmed);
    await vi.advanceTimersByTimeAsync(0);

    expect(confirmClick).toHaveBeenCalledTimes(1);
  });

  it('should wait for a dialog that opens after a delay', async () => {
    const resetButton = renderResetButton('class');
    const confirmButton = attachConfirmDialog(resetButton, 'Confirm', 200);
    const confirmClick = vi.spyOn(confirmButton, 'click');

    dispose = setupLeetcodeAutoReset(onResetConfirmed);
    await vi.advanceTimersByTimeAsync(0);
    expect(confirmClick).not.toHaveBeenCalled();

    await vi.advanceTimersByTimeAsync(500);
    expect(confirmClick).toHaveBeenCalledTimes(1);
  });

  it('should ignore dialogs that were already open before the reset', async () => {
    const staleDialog = createConfirmDialog('Confirm');
    document.body.appendChild(staleDialog);
    const staleClick = vi.spyOn(staleDialog.querySelectorAll('button')[1] as HTMLButtonElement, 'click');

    const resetButton = renderResetButton('class');
    const resetClick = vi.spyOn(resetButton, 'click');
    const confirmButton = attachConfirmDialog(resetButton, 'Confirm');
    const confirmClick = vi.spyOn(confirmButton, 'click');

    dispose = setupLeetcodeAutoReset(onResetConfirmed);
    await vi.advanceTimersByTimeAsync(0);

    expect(resetClick).toHaveBeenCalledTimes(1);
    expect(staleClick).not.toHaveBeenCalled();
    expect(confirmClick).toHaveBeenCalledTimes(1);
  });

  it('should do nothing when reset on every problem is disabled', async () => {
    vi.mocked(sendMessage).mockResolvedValue(false);
    const resetButton = renderResetButton('class');
    const resetClick = vi.spyOn(resetButton, 'click');

    dispose = setupLeetcodeAutoReset(onResetConfirmed);
    await vi.advanceTimersByTimeAsync(0);

    expect(resetClick).not.toHaveBeenCalled();
  });

  it('throttles repeated checks and retries after one second', async () => {
    vi.setSystemTime(0);
    dispose = setupLeetcodeAutoReset(onResetConfirmed);
    await vi.advanceTimersByTimeAsync(0);

    window.dispatchEvent(new PopStateEvent('popstate'));
    await vi.advanceTimersByTimeAsync(999);
    window.dispatchEvent(new PopStateEvent('popstate'));
    expect(sendMessage).toHaveBeenCalledTimes(1);

    await vi.advanceTimersByTimeAsync(1);
    expect(sendMessage).toHaveBeenCalledTimes(2);
  });

  it.each([
    ['two-sum', 'resolve'],
    ['two-sum', 'reject'],
    ['three-sum', 'resolve'],
    ['three-sum', 'reject'],
  ])('does not throttle skipped checks for %s while an active request waits to %s', async (slug, outcome) => {
    const decision = createDeferred<boolean>();
    vi.mocked(sendMessage).mockReturnValueOnce(decision.promise);
    dispose = setupLeetcodeAutoReset(onResetConfirmed);

    await vi.advanceTimersByTimeAsync(1100);
    history.pushState({}, '', `/problems/${slug}/`);
    window.dispatchEvent(new PopStateEvent('popstate'));
    expect(sendMessage).toHaveBeenCalledTimes(1);

    if (outcome === 'resolve') decision.resolve(false);
    else decision.reject(new Error('Background unavailable'));
    await vi.advanceTimersByTimeAsync(0);
    window.dispatchEvent(new PopStateEvent('popstate'));
    await vi.advanceTimersByTimeAsync(0);

    expect(sendMessage).toHaveBeenCalledTimes(2);
    expect(sendMessage).toHaveBeenLastCalledWith('shouldResetEditor', { slug, domain: 'leetcode.com' });

    window.dispatchEvent(new PopStateEvent('popstate'));
    expect(sendMessage).toHaveBeenCalledTimes(2);
  });

  it('retries when the reset button becomes available', async () => {
    dispose = setupLeetcodeAutoReset(onResetConfirmed);
    await vi.advanceTimersByTimeAsync(0);

    const resetButton = renderResetButton('class');
    const confirmButton = attachConfirmDialog(resetButton, 'Confirm');
    const confirmClick = vi.spyOn(confirmButton, 'click');

    await vi.advanceTimersByTimeAsync(1000);

    expect(confirmClick).toHaveBeenCalledTimes(1);
    expect(onResetConfirmed).toHaveBeenCalledTimes(1);
  });

  it('does not retry or notify when confirmation times out', async () => {
    const resetButton = renderResetButton('class');
    const resetClick = vi.spyOn(resetButton, 'click');

    dispose = setupLeetcodeAutoReset(onResetConfirmed);
    await vi.advanceTimersByTimeAsync(5000);

    expect(resetClick).toHaveBeenCalledTimes(1);
    expect(sendMessage).toHaveBeenCalledTimes(1);
    expect(onResetConfirmed).not.toHaveBeenCalled();
  });

  it.each([
    ['/problems/three-sum/', 'three-sum'],
    ['/problemset/', 'two-sum'],
  ])('resets the retry throttle after visiting %s', async (path, expectedSlug) => {
    dispose = setupLeetcodeAutoReset(onResetConfirmed);
    await vi.advanceTimersByTimeAsync(100);

    history.pushState({}, '', path);
    window.dispatchEvent(new PopStateEvent('popstate'));
    if (path === '/problemset/') {
      expect(sendMessage).toHaveBeenCalledTimes(1);
      history.pushState({}, '', '/problems/two-sum/');
      window.dispatchEvent(new PopStateEvent('popstate'));
    }
    await vi.advanceTimersByTimeAsync(0);

    expect(sendMessage).toHaveBeenCalledTimes(2);
    expect(sendMessage).toHaveBeenLastCalledWith('shouldResetEditor', {
      slug: expectedSlug,
      domain: 'leetcode.com',
    });
  });

  it('asks for a reset decision using the current problem', async () => {
    dispose = setupLeetcodeAutoReset(onResetConfirmed);
    await vi.advanceTimersByTimeAsync(0);

    expect(sendMessage).toHaveBeenCalledWith('shouldResetEditor', {
      slug: 'two-sum',
      domain: 'leetcode.com',
    });
  });
});
