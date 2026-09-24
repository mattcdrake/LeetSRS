// @vitest-environment happy-dom

import { State } from 'ts-fsrs';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fakeBrowser } from 'wxt/testing/fake-browser';
import { background } from '@/shared/background-service';
import { replaceLearningDocument } from '@/shared/learning-document';
import { requireDefined } from '@/test/utils/assertions';
import { buildCatalogProblem, createMockCard } from '@/test/utils/card-mocks';
import { buildLearningDocument } from '@/test/utils/learning-document-mocks';
import { createServiceMock } from '@/test/utils/service-mocks';
import { setupLeetcodeEditorReset } from '../editor-reset';

vi.mock('@/shared/background-service');

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

  beforeEach(async () => {
    fakeBrowser.reset();
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-09-20T12:00:00Z'));
    history.replaceState({}, '', '/problems/two-sum/');
    createServiceMock(background).resolve('getProblem', buildCatalogProblem());
    await replaceLearningDocument(
      buildLearningDocument({
        cards: { '1': createMockCard(State.Review) },
        settings: { resetEditorOnReviewQueue: true },
      })
    );
  });

  afterEach(() => {
    dispose?.();
    dispose = undefined;
    document.body.innerHTML = '';
    vi.clearAllTimers();
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it.each(['2026-09-19T12:00:00', '2026-09-20T23:59:59.999'])(
    'resets a problem due at %s once without changing the URL',
    async (due) => {
      const card = createMockCard(State.Review);
      card.fsrs.due = new Date(due).getTime();
      await replaceLearningDocument(
        buildLearningDocument({
          cards: { '1': card },
          settings: { resetEditorOnReviewQueue: true },
        })
      );
      history.replaceState({}, '', '/problems/two-sum/?envType=study-plan#description');
      const resetButton = renderResetButton();
      const resetClick = vi.spyOn(resetButton, 'click');
      const dialog = createDialog();
      attachDialog(resetButton, dialog.dialog);

      dispose = setupLeetcodeEditorReset(onResetConfirmed);
      await vi.advanceTimersByTimeAsync(100);
      expect(resetClick).toHaveBeenCalledTimes(1);
      expect(dialog.clicks[1]).toHaveBeenCalledTimes(1);
      expect(onResetConfirmed).toHaveBeenCalledTimes(1);
      expect(location.search).toBe('?envType=study-plan');
      expect(location.hash).toBe('#description');

      dialog.dialog.remove();
      await vi.advanceTimersByTimeAsync(10_000);
      expect(resetClick).toHaveBeenCalledTimes(1);
      expect(vi.getTimerCount()).toBe(0);
    }
  );

  it.each([
    ['disabled', buildLearningDocument({ cards: { '1': createMockCard(State.Review) } })],
    ['unsaved', buildLearningDocument({ settings: { resetEditorOnReviewQueue: true } })],
    [
      'paused',
      buildLearningDocument({
        cards: { '1': createMockCard(State.Review, { paused: true }) },
        settings: { resetEditorOnReviewQueue: true },
      }),
    ],
    [
      'not due',
      buildLearningDocument({
        cards: {
          '1': {
            ...createMockCard(State.Review),
            fsrs: { ...createMockCard(State.Review).fsrs, due: Date.parse('2026-09-21T12:00:00Z') },
          },
        },
        settings: { resetEditorOnReviewQueue: true },
      }),
    ],
  ] as const)('preserves code when %s', async (_reason, document) => {
    await replaceLearningDocument(document);
    const resetClick = vi.spyOn(renderResetButton(), 'click');
    dispose = setupLeetcodeEditorReset(onResetConfirmed);
    await vi.advanceTimersByTimeAsync(10_000);
    expect(resetClick).not.toHaveBeenCalled();
    expect(onResetConfirmed).not.toHaveBeenCalled();
    expect(vi.getTimerCount()).toBe(0);
  });

  it('does not reset later while working if the problem was not due on arrival', async () => {
    vi.setSystemTime(new Date('2026-09-20T23:59:59'));
    const card = createMockCard(State.Review);
    await replaceLearningDocument(
      buildLearningDocument({
        cards: { '1': { ...card, fsrs: { ...card.fsrs, due: Date.now() + 1000 } } },
        settings: { resetEditorOnReviewQueue: true },
      })
    );
    const resetClick = vi.spyOn(renderResetButton(), 'click');
    dispose = setupLeetcodeEditorReset(onResetConfirmed);
    await vi.advanceTimersByTimeAsync(5000);
    expect(resetClick).not.toHaveBeenCalled();
  });

  it('ignores a due-state result received after leaving the problem', async () => {
    const pending = Promise.withResolvers<ReturnType<typeof buildCatalogProblem>>();
    vi.mocked(background.getProblem).mockReturnValue(pending.promise);
    const resetClick = vi.spyOn(renderResetButton(), 'click');
    dispose = setupLeetcodeEditorReset(onResetConfirmed);
    await vi.advanceTimersByTimeAsync(100);
    history.pushState({}, '', '/problems/add-two-numbers/');
    pending.resolve(buildCatalogProblem());
    await vi.advanceTimersByTimeAsync(100);
    expect(resetClick).not.toHaveBeenCalled();
    expect(onResetConfirmed).not.toHaveBeenCalled();
    expect(vi.getTimerCount()).toBe(0);
  });

  it.each([
    '<button><svg class="fa-arrow-rotate-left"></svg></button>',
    '<button><svg data-icon="arrow-rotate-left"></svg></button>',
    '<div role="button"><span><svg class="fa-arrow-rotate-left"></svg></span></div>',
  ])('waits for a supported reset control and confirms it once: %s', async (markup) => {
    dispose = setupLeetcodeEditorReset(onResetConfirmed);
    await vi.advanceTimersByTimeAsync(500);

    const resetButton = renderResetButton(markup);
    const resetClick = vi.spyOn(resetButton, 'click');
    const dialog = createDialog(['确定', 'Cancel'], 'role="alertdialog"');
    await vi.waitFor(() => expect(resetClick).toHaveBeenCalledOnce());
    expect(dialog.clicks[0]).not.toHaveBeenCalled();
    expect(onResetConfirmed).not.toHaveBeenCalled();
    document.body.appendChild(dialog.dialog);
    await vi.waitFor(() => expect(onResetConfirmed).toHaveBeenCalledOnce());

    expect(resetClick).toHaveBeenCalledTimes(1);
    expect(dialog.clicks[0]).toHaveBeenCalledTimes(1);
    expect(dialog.clicks[1]).not.toHaveBeenCalled();
    expect(onResetConfirmed).toHaveBeenCalledTimes(1);
    expect(vi.getTimerCount()).toBe(0);
  });

  it('continues resetting when LeetCode normalizes the URL for the same problem', async () => {
    history.replaceState({}, '', '/problems/two-sum/description/');
    dispose = setupLeetcodeEditorReset(onResetConfirmed);
    await vi.advanceTimersByTimeAsync(100);

    history.replaceState({}, '', '/problems/two-sum/');
    const resetButton = renderResetButton();
    const resetClick = vi.spyOn(resetButton, 'click');
    const dialog = createDialog();
    attachDialog(resetButton, dialog.dialog);
    await vi.advanceTimersByTimeAsync(100);

    expect(resetClick).toHaveBeenCalledTimes(1);
    expect(dialog.clicks[1]).toHaveBeenCalledTimes(1);
    expect(onResetConfirmed).toHaveBeenCalledTimes(1);
    expect(location.hash).toBe('');
    expect(vi.getTimerCount()).toBe(0);
  });

  it('stops polling when the reset control never appears', async () => {
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

    dispose = setupLeetcodeEditorReset(onResetConfirmed);
    await vi.advanceTimersByTimeAsync(100);

    for (const click of existing.clicks) expect(click).not.toHaveBeenCalled();
    expect(opened.clicks[0]).not.toHaveBeenCalled();
    expect(opened.clicks[1]).toHaveBeenCalledTimes(1);
    expect(onResetConfirmed).toHaveBeenCalledTimes(1);
  });

  it.each(['navigation', 'dispose'])('invalidates delayed work on %s', async (change) => {
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
    dispose = setupLeetcodeEditorReset(onResetConfirmed);
    await vi.advanceTimersByTimeAsync(100);

    history.pushState({}, '', '/problemset/');
    await vi.advanceTimersByTimeAsync(200);

    expect(dialog.clicks[1]).not.toHaveBeenCalled();
    expect(onResetConfirmed).not.toHaveBeenCalled();
    expect(vi.getTimerCount()).toBe(0);
  });

  it('times out without retrying reset or clicking a later or unrecognized dialog', async () => {
    const resetButton = renderResetButton();
    const resetClick = vi.spyOn(resetButton, 'click');
    const dialog = createDialog(['Abbrechen', 'Bestätigen']);
    attachDialog(resetButton, dialog.dialog);
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
});
