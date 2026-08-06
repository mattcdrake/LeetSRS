import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { setupLeetcodeAutoReset } from '../auto-reset';
import { sendMessage } from '@/shared/messages';

// @vitest-environment happy-dom

vi.mock('@/shared/messages', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/shared/messages')>()),
  sendMessage: vi.fn(),
}));

type ResetIconMarkup = 'class' | 'data-icon';

/**
 * LeetCode inlines FontAwesome icons into the editor toolbar. Current markup only
 * carries the icon name in the class list, older markup also set data-icon.
 */
function renderResetButton(markup: ResetIconMarkup): HTMLButtonElement {
  const icon =
    markup === 'class'
      ? '<svg class="svg-inline--fa fa-arrow-rotate-left" aria-hidden="true"><path d="M40 224c-13.3 0" /></svg>'
      : '<svg data-icon="arrow-rotate-left" aria-hidden="true"><path d="M40 224c-13.3 0" /></svg>';

  const toolbar = document.createElement('div');
  toolbar.className = 'flex h-full items-center gap-1';
  toolbar.innerHTML = `<button data-state="closed">${icon}</button>`;
  document.body.appendChild(toolbar);

  return toolbar.querySelector('button')!;
}

function createConfirmDialog(confirmLabel: string): HTMLElement {
  const dialog = document.createElement('div');
  dialog.setAttribute('role', 'dialog');
  dialog.setAttribute('aria-modal', 'true');
  dialog.innerHTML = `<button>Cancel</button><button>${confirmLabel}</button>`;

  return dialog;
}

/** Opens the confirm dialog when the reset button is clicked, as LeetCode does. */
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

    dispose = setupLeetcodeAutoReset();
    await vi.advanceTimersByTimeAsync(0);

    expect(resetClick).toHaveBeenCalledTimes(1);
    expect(confirmClick).toHaveBeenCalledTimes(1);
  });

  it('should still find the reset button via the legacy data-icon attribute', async () => {
    const resetButton = renderResetButton('data-icon');
    const confirmButton = attachConfirmDialog(resetButton, 'Confirm');
    const confirmClick = vi.spyOn(confirmButton, 'click');

    dispose = setupLeetcodeAutoReset();
    await vi.advanceTimersByTimeAsync(0);

    expect(confirmClick).toHaveBeenCalledTimes(1);
  });

  it('should confirm the localized dialog on leetcode.cn', async () => {
    const resetButton = renderResetButton('class');
    const confirmButton = attachConfirmDialog(resetButton, '确认');
    const confirmClick = vi.spyOn(confirmButton, 'click');

    dispose = setupLeetcodeAutoReset();
    await vi.advanceTimersByTimeAsync(0);

    expect(confirmClick).toHaveBeenCalledTimes(1);
  });

  it('should wait for a dialog that opens after a delay', async () => {
    const resetButton = renderResetButton('class');
    const confirmButton = attachConfirmDialog(resetButton, 'Confirm', 200);
    const confirmClick = vi.spyOn(confirmButton, 'click');

    dispose = setupLeetcodeAutoReset();
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

    dispose = setupLeetcodeAutoReset();
    await vi.advanceTimersByTimeAsync(0);

    expect(resetClick).toHaveBeenCalledTimes(1);
    expect(staleClick).not.toHaveBeenCalled();
    expect(confirmClick).toHaveBeenCalledTimes(1);
  });

  it('should do nothing when auto clear is disabled', async () => {
    vi.mocked(sendMessage).mockResolvedValue(false);
    const resetButton = renderResetButton('class');
    const resetClick = vi.spyOn(resetButton, 'click');

    dispose = setupLeetcodeAutoReset();
    await vi.advanceTimersByTimeAsync(0);

    expect(resetClick).not.toHaveBeenCalled();
  });
});
