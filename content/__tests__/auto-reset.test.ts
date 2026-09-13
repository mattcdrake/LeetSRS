import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { storage } from '#imports';
import type { LearningDocument } from '@/domain/learning-document';
import { requireDefined } from '@/test/utils/assertions';
import { buildLearningDocument } from '@/test/utils/learning-document-mocks';
import { setupLeetcodeAutoReset } from '../auto-reset';

// @vitest-environment happy-dom

function renderResetButton(): HTMLButtonElement {
  const icon = '<svg class="svg-inline--fa fa-arrow-rotate-left" aria-hidden="true"><path d="M40 224c-13.3 0" /></svg>';

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
    vi.spyOn(storage, 'getItem');
    vi.mocked(storage.getItem).mockResolvedValue(
      buildLearningDocument({ settings: { resetEditorOnEveryProblem: true } })
    );
    history.pushState({}, '', '/problems/two-sum/');
  });

  afterEach(() => {
    dispose?.();
    dispose = undefined;
    document.body.innerHTML = '';
    vi.clearAllTimers();
    vi.useRealTimers();
  });

  it('polls editor readiness once per second without rechecking eligibility', async () => {
    vi.setSystemTime(0);
    dispose = setupLeetcodeAutoReset(onResetConfirmed);
    await vi.advanceTimersByTimeAsync(0);

    const resetButton = renderResetButton();
    const confirmButton = attachConfirmDialog(resetButton, 'Confirm');
    const confirmClick = vi.spyOn(confirmButton, 'click');
    window.dispatchEvent(new PopStateEvent('popstate'));
    await vi.advanceTimersByTimeAsync(999);
    window.dispatchEvent(new PopStateEvent('popstate'));
    expect(storage.getItem).toHaveBeenCalledTimes(1);
    expect(confirmClick).not.toHaveBeenCalled();

    await vi.advanceTimersByTimeAsync(1);
    expect(storage.getItem).toHaveBeenCalledTimes(1);
    expect(confirmClick).toHaveBeenCalledTimes(1);
  });

  it.each([
    ['two-sum', 'resolve'],
    ['two-sum', 'reject'],
    ['three-sum', 'resolve'],
    ['three-sum', 'reject'],
  ])('skips overlapping requests and retains the decision for %s after %s', async (slug, outcome) => {
    const decision = Promise.withResolvers<LearningDocument>();
    vi.mocked(storage.getItem).mockReturnValueOnce(decision.promise);
    dispose = setupLeetcodeAutoReset(onResetConfirmed);

    await vi.advanceTimersByTimeAsync(1100);
    history.pushState({}, '', `/problems/${slug}/`);
    window.dispatchEvent(new PopStateEvent('popstate'));
    expect(storage.getItem).toHaveBeenCalledTimes(1);

    if (outcome === 'resolve') decision.resolve(buildLearningDocument());
    else decision.reject(new Error('Background unavailable'));
    await vi.advanceTimersByTimeAsync(899);
    expect(storage.getItem).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(1);

    const expectedCalls = slug === 'two-sum' && outcome === 'resolve' ? 1 : 2;
    expect(storage.getItem).toHaveBeenCalledTimes(expectedCalls);

    window.dispatchEvent(new PopStateEvent('popstate'));
    expect(storage.getItem).toHaveBeenCalledTimes(expectedCalls);
  });

  it('retains an approved decision while waiting for the reset button', async () => {
    dispose = setupLeetcodeAutoReset(onResetConfirmed);
    await vi.advanceTimersByTimeAsync(0);
    vi.mocked(storage.getItem).mockResolvedValue(buildLearningDocument());

    const resetButton = renderResetButton();
    const confirmButton = attachConfirmDialog(resetButton, 'Confirm');
    const confirmClick = vi.spyOn(confirmButton, 'click');

    await vi.advanceTimersByTimeAsync(1000);

    expect(confirmClick).toHaveBeenCalledTimes(1);
    expect(onResetConfirmed).toHaveBeenCalledTimes(1);
    expect(storage.getItem).toHaveBeenCalledTimes(1);
  });

  it.each(['/problems/three-sum/', '/problemset/'])(
    'keeps a declined decision until leaving for %s and returning',
    async (path) => {
      vi.mocked(storage.getItem).mockResolvedValue(buildLearningDocument());
      const resetButton = renderResetButton();
      attachConfirmDialog(resetButton, 'Confirm');
      const resetClick = vi.spyOn(resetButton, 'click');
      dispose = setupLeetcodeAutoReset(onResetConfirmed);
      await vi.advanceTimersByTimeAsync(0);

      // Becoming due or enabling auto-reset must not reset an already-open visit.
      vi.mocked(storage.getItem).mockResolvedValue(
        buildLearningDocument({ settings: { resetEditorOnEveryProblem: true } })
      );
      vi.setSystemTime(Date.now() + 24 * 60 * 60 * 1000);
      await vi.advanceTimersByTimeAsync(5000);
      expect(storage.getItem).toHaveBeenCalledTimes(1);
      expect(resetClick).not.toHaveBeenCalled();
      expect(onResetConfirmed).not.toHaveBeenCalled();

      vi.mocked(storage.getItem).mockResolvedValue(buildLearningDocument());
      history.pushState({}, '', path);
      await vi.advanceTimersByTimeAsync(1000);
      vi.mocked(storage.getItem).mockResolvedValue(
        buildLearningDocument({ settings: { resetEditorOnEveryProblem: true } })
      );
      history.pushState({}, '', '/problems/two-sum/');
      await vi.advanceTimersByTimeAsync(1000);

      expect(resetClick).toHaveBeenCalledTimes(1);
      expect(onResetConfirmed).toHaveBeenCalledTimes(1);
    }
  );

  it('does not retry or notify when confirmation times out', async () => {
    const resetButton = renderResetButton();
    const resetClick = vi.spyOn(resetButton, 'click');

    dispose = setupLeetcodeAutoReset(onResetConfirmed);
    await vi.advanceTimersByTimeAsync(5000);

    expect(resetClick).toHaveBeenCalledTimes(1);
    expect(storage.getItem).toHaveBeenCalledTimes(1);
    expect(onResetConfirmed).not.toHaveBeenCalled();
  });

  it.each(['/problems/three-sum/', '/problemset/'])(
    'resets again after leaving for %s and returning, even without an intervening reset',
    async (path) => {
      const resetButton = renderResetButton();
      const confirmButton = attachConfirmDialog(resetButton, 'Confirm');
      confirmButton.addEventListener('click', () => confirmButton.parentElement?.remove());
      const resetClick = vi.spyOn(resetButton, 'click');
      dispose = setupLeetcodeAutoReset(onResetConfirmed);
      await vi.advanceTimersByTimeAsync(2000);
      expect(resetClick).toHaveBeenCalledTimes(1);

      vi.mocked(storage.getItem).mockResolvedValue(buildLearningDocument());
      history.pushState({}, '', path);
      await vi.advanceTimersByTimeAsync(1000);
      expect(resetClick).toHaveBeenCalledTimes(1);

      vi.mocked(storage.getItem).mockResolvedValue(
        buildLearningDocument({ settings: { resetEditorOnEveryProblem: true } })
      );
      history.pushState({}, '', '/problems/two-sum/');
      await vi.advanceTimersByTimeAsync(1000);
      expect(resetClick).toHaveBeenCalledTimes(2);
      expect(onResetConfirmed).toHaveBeenCalledTimes(2);
      await vi.advanceTimersByTimeAsync(2000);
      expect(resetClick).toHaveBeenCalledTimes(2);
    }
  );

  it.each(['navigation', 'dispose'])('ignores a pending reset decision after %s', async (change) => {
    const decision = Promise.withResolvers<LearningDocument>();
    vi.mocked(storage.getItem).mockReturnValueOnce(decision.promise);
    const resetButton = renderResetButton();
    const resetClick = vi.spyOn(resetButton, 'click');
    dispose = setupLeetcodeAutoReset(onResetConfirmed);

    if (change === 'navigation') history.pushState({}, '', '/problems/three-sum/');
    else dispose();
    decision.resolve(buildLearningDocument({ settings: { resetEditorOnEveryProblem: true } }));
    await vi.advanceTimersByTimeAsync(0);

    expect(resetClick).not.toHaveBeenCalled();
    expect(onResetConfirmed).not.toHaveBeenCalled();
  });

  it('ignores a decision from an earlier visit to the same problem', async () => {
    const decision = Promise.withResolvers<LearningDocument>();
    vi.mocked(storage.getItem).mockReturnValueOnce(decision.promise);
    const resetButton = renderResetButton();
    const resetClick = vi.spyOn(resetButton, 'click');
    attachConfirmDialog(resetButton, 'Confirm');
    dispose = setupLeetcodeAutoReset(onResetConfirmed);

    history.pushState({}, '', '/problemset/');
    await vi.advanceTimersByTimeAsync(1000);
    history.pushState({}, '', '/problems/two-sum/');
    await vi.advanceTimersByTimeAsync(1000);
    decision.resolve(buildLearningDocument({ settings: { resetEditorOnEveryProblem: true } }));
    await vi.advanceTimersByTimeAsync(0);
    expect(resetClick).not.toHaveBeenCalled();

    await vi.advanceTimersByTimeAsync(1000);
    expect(resetClick).toHaveBeenCalledTimes(1);
    expect(onResetConfirmed).toHaveBeenCalledTimes(1);
  });

  it.each(['navigation', 'dispose'])('stops pending confirmation clicks after %s', async (change) => {
    const resetButton = renderResetButton();
    const confirmButton = attachConfirmDialog(resetButton, 'Confirm', 200);
    const confirmClick = vi.spyOn(confirmButton, 'click');
    dispose = setupLeetcodeAutoReset(onResetConfirmed);
    await vi.advanceTimersByTimeAsync(0);

    if (change === 'navigation') history.pushState({}, '', '/problemset/');
    else dispose();
    await vi.advanceTimersByTimeAsync(500);

    expect(confirmClick).not.toHaveBeenCalled();
    expect(onResetConfirmed).not.toHaveBeenCalled();
    if (change === 'dispose') expect(vi.getTimerCount()).toBe(0);
  });
});
