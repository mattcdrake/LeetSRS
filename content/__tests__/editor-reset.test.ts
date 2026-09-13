// @vitest-environment happy-dom

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { requireDefined } from '@/test/utils/assertions';
import { setupLeetcodeEditorReset } from '../editor-reset';

const AUTHORIZATION_HASH = '#leetsrs-reset-editor';

function authorizeOpening(path = '/problems/two-sum/'): void {
  history.replaceState({}, '', `${path}${AUTHORIZATION_HASH}`);
}

function renderResetButton(markup = '<button><svg class="fa-arrow-rotate-left"></svg></button>'): HTMLElement {
  const container = document.createElement('div');
  container.innerHTML = markup;
  document.body.appendChild(container);
  return requireDefined(container.querySelector<HTMLElement>('button, [role="button"]'));
}

function createDialog(labels = ['Cancel', 'Confirm'], attributes = 'role="dialog" aria-modal="true"') {
  const container = document.createElement('div');
  container.innerHTML = `<div ${attributes}>${labels.map((label) => `<button>${label}</button>`).join('')}</div>`;
  const dialog = requireDefined(container.firstElementChild);
  const clicks = Array.from(dialog.querySelectorAll('button'), (button) => vi.spyOn(button, 'click'));
  return { dialog, clicks };
}

function attachDialog(resetButton: HTMLElement, dialog: Element, delayMs = 0): void {
  resetButton.addEventListener('click', () => {
    window.setTimeout(() => document.body.appendChild(dialog), delayMs);
  });
}

describe('setupLeetcodeEditorReset', () => {
  let dispose: (() => void) | undefined;
  const onResetConfirmed = vi.fn();

  beforeEach(() => {
    vi.useFakeTimers();
    history.replaceState({}, '', '/problems/two-sum/');
  });

  afterEach(() => {
    dispose?.();
    dispose = undefined;
    document.body.innerHTML = '';
    vi.clearAllTimers();
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it('preserves code during ordinary browsing and consumes one authorization per opening', async () => {
    const resetButton = renderResetButton();
    const resetClick = vi.spyOn(resetButton, 'click');
    const dialog = createDialog();
    attachDialog(resetButton, dialog.dialog);

    dispose = setupLeetcodeEditorReset(onResetConfirmed);
    await vi.advanceTimersByTimeAsync(100);
    expect(resetClick).not.toHaveBeenCalled();
    expect(vi.getTimerCount()).toBe(0);
    dispose();

    authorizeOpening();
    dispose = setupLeetcodeEditorReset(onResetConfirmed);
    setupLeetcodeEditorReset(onResetConfirmed);
    await vi.advanceTimersByTimeAsync(100);

    expect(location.hash).toBe('');
    expect(resetClick).toHaveBeenCalledTimes(1);
    expect(dialog.clicks[1]).toHaveBeenCalledTimes(1);
    expect(onResetConfirmed).toHaveBeenCalledTimes(1);
    expect(vi.getTimerCount()).toBe(0);
  });

  it.each([
    '<button><svg class="fa-arrow-rotate-left"></svg></button>',
    '<button><svg data-icon="arrow-rotate-left"></svg></button>',
    '<div role="button"><span><svg class="fa-arrow-rotate-left"></svg></span></div>',
  ])('waits for a supported reset control and confirms it once: %s', async (markup) => {
    authorizeOpening();
    dispose = setupLeetcodeEditorReset(onResetConfirmed);
    await vi.advanceTimersByTimeAsync(500);

    const resetButton = renderResetButton(markup);
    const resetClick = vi.spyOn(resetButton, 'click');
    const dialog = createDialog(['确定', 'Cancel'], 'role="alertdialog"');
    attachDialog(resetButton, dialog.dialog, 200);

    await vi.advanceTimersByTimeAsync(249);
    expect(dialog.clicks[0]).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(1);

    expect(resetClick).toHaveBeenCalledTimes(1);
    expect(dialog.clicks[0]).toHaveBeenCalledTimes(1);
    expect(dialog.clicks[1]).not.toHaveBeenCalled();
    expect(onResetConfirmed).toHaveBeenCalledTimes(1);
    expect(vi.getTimerCount()).toBe(0);
  });

  it('stops polling when the reset control never appears', async () => {
    authorizeOpening();
    dispose = setupLeetcodeEditorReset(onResetConfirmed);

    await vi.advanceTimersByTimeAsync(10_000);
    expect(vi.getTimerCount()).toBe(0);

    const resetClick = vi.spyOn(renderResetButton(), 'click');
    await vi.advanceTimersByTimeAsync(100);
    expect(resetClick).not.toHaveBeenCalled();
    expect(onResetConfirmed).not.toHaveBeenCalled();
  });

  it('ignores dialogs open before reset and confirms only a recognized control in a new modal', async () => {
    const resetButton = renderResetButton();
    const existing = createDialog();
    document.body.appendChild(existing.dialog);
    const opened = createDialog(['Unknown', '  CoNfIrM  ']);
    attachDialog(resetButton, opened.dialog);
    authorizeOpening();

    dispose = setupLeetcodeEditorReset(onResetConfirmed);
    await vi.advanceTimersByTimeAsync(100);

    for (const click of existing.clicks) expect(click).not.toHaveBeenCalled();
    expect(opened.clicks[0]).not.toHaveBeenCalled();
    expect(opened.clicks[1]).toHaveBeenCalledTimes(1);
    expect(onResetConfirmed).toHaveBeenCalledTimes(1);
  });

  it.each(['navigation', 'dispose'])('invalidates delayed work on %s', async (change) => {
    authorizeOpening();
    dispose = setupLeetcodeEditorReset(onResetConfirmed);
    await vi.advanceTimersByTimeAsync(100);

    if (change === 'navigation') history.pushState({}, '', '/problems/three-sum/');
    else dispose();
    const resetClick = vi.spyOn(renderResetButton(), 'click');
    await vi.advanceTimersByTimeAsync(100);

    expect(resetClick).not.toHaveBeenCalled();
    expect(onResetConfirmed).not.toHaveBeenCalled();
    expect(vi.getTimerCount()).toBe(0);
  });

  it('does not confirm after navigation makes a clicked reset stale', async () => {
    const resetButton = renderResetButton();
    const dialog = createDialog();
    attachDialog(resetButton, dialog.dialog, 200);
    authorizeOpening();
    dispose = setupLeetcodeEditorReset(onResetConfirmed);
    await vi.advanceTimersByTimeAsync(100);

    history.pushState({}, '', '/problemset/');
    await vi.advanceTimersByTimeAsync(200);

    expect(dialog.clicks[1]).not.toHaveBeenCalled();
    expect(onResetConfirmed).not.toHaveBeenCalled();
    expect(vi.getTimerCount()).toBe(0);
  });

  it('times out without retrying reset or clicking a later or unrecognized dialog', async () => {
    vi.setSystemTime(0);
    const resetButton = renderResetButton();
    const resetClick = vi.spyOn(resetButton, 'click');
    const dialog = createDialog(['Abbrechen', 'Bestätigen']);
    attachDialog(resetButton, dialog.dialog);
    authorizeOpening();
    dispose = setupLeetcodeEditorReset(onResetConfirmed);

    await vi.advanceTimersByTimeAsync(2000);
    expect(resetClick).toHaveBeenCalledTimes(1);
    for (const click of dialog.clicks) expect(click).not.toHaveBeenCalled();
    expect(onResetConfirmed).not.toHaveBeenCalled();
    expect(vi.getTimerCount()).toBe(0);

    const late = createDialog();
    document.body.appendChild(late.dialog);
    await vi.advanceTimersByTimeAsync(3000);
    expect(resetClick).toHaveBeenCalledTimes(1);
    for (const click of late.clicks) expect(click).not.toHaveBeenCalled();
  });

  it('does not replay consumed authorization on refresh or history restoration', async () => {
    const resetButton = renderResetButton();
    const resetClick = vi.spyOn(resetButton, 'click');
    const first = createDialog();
    attachDialog(resetButton, first.dialog);
    authorizeOpening('/problems/two-sum/');

    dispose = setupLeetcodeEditorReset(onResetConfirmed);
    await vi.advanceTimersByTimeAsync(100);
    dispose();
    first.dialog.remove();
    history.pushState({}, '', '/problemset/');
    history.back();
    await vi.advanceTimersByTimeAsync(100);
    dispose = setupLeetcodeEditorReset(onResetConfirmed);
    await vi.advanceTimersByTimeAsync(100);

    expect(location.hash).toBe('');
    expect(resetClick).toHaveBeenCalledTimes(1);
    expect(onResetConfirmed).toHaveBeenCalledTimes(1);
    expect(vi.getTimerCount()).toBe(0);
  });
});
