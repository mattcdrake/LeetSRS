// @vitest-environment happy-dom

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { requireDefined } from '@/test/utils/assertions';
import { resetLeetcodeEditor } from '../reset-leetcode-editor';

function renderResetButton(markup = '<button><svg class="fa-arrow-rotate-left"></svg></button>'): HTMLElement {
  document.body.innerHTML = markup;
  return requireDefined(document.querySelector<HTMLElement>('button, [role="button"]'));
}

function createDialog(labels = ['Cancel', 'Confirm'], attributes = 'role="dialog" aria-modal="true"') {
  const container = document.createElement('div');
  container.innerHTML = `<div ${attributes}>${labels.map((label) => `<button>${label}</button>`).join('')}</div>`;
  const dialog = requireDefined(container.firstElementChild);
  const clicks = Array.from(dialog.querySelectorAll('button'), (button) => vi.spyOn(button, 'click'));
  return { dialog, clicks };
}

describe('resetLeetcodeEditor', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    document.body.innerHTML = '';
    vi.clearAllTimers();
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it.each(['', '<svg class="fa-arrow-rotate-left"></svg>', '<button>Reset</button>'])(
    'returns unavailable without a supported reset control: %s',
    async (markup) => {
      document.body.innerHTML = markup;

      await expect(resetLeetcodeEditor()).resolves.toBe('unavailable');
      expect(vi.getTimerCount()).toBe(0);
    }
  );

  it.each([
    '<button><svg class="fa-arrow-rotate-left"></svg></button>',
    '<button><svg data-icon="arrow-rotate-left"></svg></button>',
    '<div role="button"><span><svg class="fa-arrow-rotate-left"></svg></span></div>',
    '<svg class="fa-arrow-rotate-left"></svg><button><svg class="fa-arrow-rotate-left"></svg></button>',
  ])('resets and immediately confirms supported markup: %s', async (markup) => {
    const resetButton = renderResetButton(markup);
    const resetClick = vi.spyOn(resetButton, 'click');
    const { dialog, clicks } = createDialog();
    resetButton.addEventListener('click', () => document.body.appendChild(dialog));

    await expect(resetLeetcodeEditor()).resolves.toBe('confirmed');

    expect(resetClick).toHaveBeenCalledTimes(1);
    expect(clicks[0]).not.toHaveBeenCalled();
    expect(clicks[1]).toHaveBeenCalledTimes(1);
    expect(vi.getTimerCount()).toBe(0);
  });

  it.each(['  CoNfIrM  ', '确认', '确定'])('prefers the recognized label %s over button order', async (label) => {
    const resetButton = renderResetButton();
    const { dialog, clicks } = createDialog([label, 'Cancel']);
    resetButton.addEventListener('click', () => document.body.appendChild(dialog));

    await expect(resetLeetcodeEditor()).resolves.toBe('confirmed');

    expect(clicks[0]).toHaveBeenCalledTimes(1);
    expect(clicks[1]).not.toHaveBeenCalled();
  });

  it('times out without clicking an unknown-locale cancel/confirm pair', async () => {
    const resetButton = renderResetButton();
    const { dialog, clicks } = createDialog(['Abbrechen', 'Bestätigen']);
    resetButton.addEventListener('click', () => document.body.appendChild(dialog));

    const result = resetLeetcodeEditor();
    await vi.advanceTimersByTimeAsync(2000);

    await expect(result).resolves.toBe('confirmation-timeout');
    for (const click of clicks) expect(click).not.toHaveBeenCalled();
    expect(vi.getTimerCount()).toBe(0);
  });

  it('supports alert dialogs', async () => {
    const resetButton = renderResetButton();
    const { dialog, clicks } = createDialog(['Cancel', 'Confirm'], 'role="alertdialog"');
    resetButton.addEventListener('click', () => document.body.appendChild(dialog));

    await expect(resetLeetcodeEditor()).resolves.toBe('confirmed');
    expect(clicks[1]).toHaveBeenCalledTimes(1);
  });

  it('ignores existing dialogs and confirms a newly opened dialog', async () => {
    const resetButton = renderResetButton();
    const existing = createDialog();
    document.body.appendChild(existing.dialog);
    const opened = createDialog();
    resetButton.addEventListener('click', () => document.body.appendChild(opened.dialog));

    await expect(resetLeetcodeEditor()).resolves.toBe('confirmed');

    for (const click of existing.clicks) expect(click).not.toHaveBeenCalled();
    expect(opened.clicks[1]).toHaveBeenCalledTimes(1);
  });

  it('waits for a delayed dialog and stops polling after confirming once', async () => {
    const resetButton = renderResetButton();
    const { dialog, clicks } = createDialog();
    resetButton.addEventListener('click', () => {
      window.setTimeout(() => document.body.appendChild(dialog), 200);
    });

    const result = resetLeetcodeEditor();
    await vi.advanceTimersByTimeAsync(199);
    expect(clicks[1]).not.toHaveBeenCalled();

    await vi.advanceTimersByTimeAsync(51);
    await expect(result).resolves.toBe('confirmed');
    expect(vi.getTimerCount()).toBe(0);

    await vi.advanceTimersByTimeAsync(3000);
    expect(clicks[1]).toHaveBeenCalledTimes(1);
  });

  it.each([
    ['unrecognized buttons', ['One', 'Two', 'Three'], 'role="dialog" aria-modal="true"'],
    ['non-modal dialog', ['Cancel', 'Confirm'], 'role="dialog"'],
  ])('times out without clicking %s', async (_description, labels, attributes) => {
    const resetButton = renderResetButton();
    const { dialog, clicks } = createDialog(labels, attributes);
    resetButton.addEventListener('click', () => document.body.appendChild(dialog));

    const result = resetLeetcodeEditor();
    await vi.advanceTimersByTimeAsync(2000);

    await expect(result).resolves.toBe('confirmation-timeout');
    for (const click of clicks) expect(click).not.toHaveBeenCalled();
    expect(vi.getTimerCount()).toBe(0);
  });

  it('times out after two seconds and does not click a dialog that appears later', async () => {
    renderResetButton();
    const settled = vi.fn();
    const result = resetLeetcodeEditor().then(settled);

    await vi.advanceTimersByTimeAsync(1999);
    expect(settled).not.toHaveBeenCalled();

    await vi.advanceTimersByTimeAsync(1);
    await result;
    expect(settled).toHaveBeenCalledExactlyOnceWith('confirmation-timeout');
    expect(vi.getTimerCount()).toBe(0);

    const { dialog, clicks } = createDialog();
    document.body.appendChild(dialog);
    await vi.advanceTimersByTimeAsync(3000);

    for (const click of clicks) expect(click).not.toHaveBeenCalled();
  });

  it('does not click reset when the visit is no longer current', async () => {
    const resetClick = vi.spyOn(renderResetButton(), 'click');
    await expect(resetLeetcodeEditor(() => false)).resolves.toBe('cancelled');
    expect(resetClick).not.toHaveBeenCalled();
    expect(vi.getTimerCount()).toBe(0);
  });

  it('cancels confirmation polling when the visit becomes stale', async () => {
    renderResetButton();
    let current = true;
    const result = resetLeetcodeEditor(() => current);
    current = false;
    const { dialog, clicks } = createDialog();
    document.body.appendChild(dialog);

    await vi.advanceTimersByTimeAsync(50);
    await expect(result).resolves.toBe('cancelled');
    for (const click of clicks) expect(click).not.toHaveBeenCalled();
    expect(vi.getTimerCount()).toBe(0);
  });
});
