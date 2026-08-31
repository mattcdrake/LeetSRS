import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  RESET_CONFIRMATION_TIMEOUT_MS,
  clickResetConfirmation,
  findEditorSettingsControl,
  findResetToDefaultCodeDefinition,
  setupClearEditorOnReview,
  waitForEditorAndReset,
} from '../editor-state';
import { sendMessage } from '@/shared/messages';

// @vitest-environment happy-dom

vi.mock('@/shared/messages', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/shared/messages')>()),
  sendMessage: vi.fn(),
}));

describe('due-review editor reset fallback', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
    history.replaceState({}, '', '/');
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
    Reflect.deleteProperty(window, 'next');
    history.replaceState({}, '', '/');
    vi.useRealTimers();
  });

  it('finds settings controls by accessible semantics and resets through LeetCode UI', async () => {
    const settings = document.createElement('button');
    settings.setAttribute('aria-label', 'Editor settings');
    const action = document.createElement('button');
    action.setAttribute('role', 'menuitem');
    action.textContent = 'Reset to Default Code Definition';
    const confirmationDialog = document.createElement('div');
    confirmationDialog.setAttribute('role', 'dialog');
    confirmationDialog.textContent = 'Reset to Default Code Definition?';
    const confirm = document.createElement('button');
    confirm.textContent = 'Reset';
    confirmationDialog.append(confirm);

    const settingsClick = vi.fn(() => document.body.append(action));
    const actionClick = vi.fn(() => document.body.append(confirmationDialog));
    const confirmClick = vi.fn();
    settings.addEventListener('click', settingsClick);
    action.addEventListener('click', actionClick);
    confirm.addEventListener('click', confirmClick);

    document.body.append(settings);
    expect(findEditorSettingsControl(document)).toBe(settings);
    expect(findResetToDefaultCodeDefinition(document)).toBeNull();

    const dispose = waitForEditorAndReset();
    await vi.waitFor(() => expect(actionClick).toHaveBeenCalledOnce());
    await vi.waitFor(() => expect(confirmClick).toHaveBeenCalledOnce());

    expect(settingsClick).toHaveBeenCalledOnce();
    expect(findResetToDefaultCodeDefinition(document)).toBe(action);
    dispose();
  });

  it('does not click a destructive action outside a confirmation dialog', () => {
    const pageReset = document.createElement('button');
    pageReset.textContent = 'Reset';
    const click = vi.fn();
    pageReset.addEventListener('click', click);
    document.body.append(pageReset);

    expect(clickResetConfirmation(document, new Set())).toBe(false);
    expect(click).not.toHaveBeenCalled();
  });

  it('only confirms a new, visible reset dialog from this reset operation', () => {
    const hiddenDialog = document.createElement('div');
    hiddenDialog.setAttribute('role', 'dialog');
    hiddenDialog.hidden = true;
    hiddenDialog.textContent = 'Reset to Default Code Definition';
    const hiddenReset = document.createElement('button');
    hiddenReset.textContent = 'Reset';
    const hiddenClick = vi.fn();
    hiddenReset.addEventListener('click', hiddenClick);
    hiddenDialog.append(hiddenReset);

    const unrelatedDialog = document.createElement('div');
    unrelatedDialog.setAttribute('role', 'dialog');
    unrelatedDialog.textContent = 'Reset to Default Code Definition';
    const unrelatedReset = document.createElement('button');
    unrelatedReset.textContent = 'Reset';
    const unrelatedClick = vi.fn();
    unrelatedReset.addEventListener('click', unrelatedClick);
    unrelatedDialog.append(unrelatedReset);

    const confirmationDialog = document.createElement('div');
    confirmationDialog.setAttribute('role', 'dialog');
    confirmationDialog.textContent = 'Reset to Default Code Definition?';
    const confirmation = document.createElement('button');
    confirmation.textContent = 'Confirm';
    const confirmationClick = vi.fn();
    confirmation.addEventListener('click', confirmationClick);
    confirmationDialog.append(confirmation);
    document.body.append(hiddenDialog, unrelatedDialog, confirmationDialog);

    expect(clickResetConfirmation(document, new Set([hiddenDialog, unrelatedDialog]))).toBe(true);
    expect(hiddenClick).not.toHaveBeenCalled();
    expect(unrelatedClick).not.toHaveBeenCalled();
    expect(confirmationClick).toHaveBeenCalledOnce();
  });

  it('stops observing shortly after a reset click when no confirmation appears', async () => {
    vi.useFakeTimers();
    const disconnect = vi.spyOn(MutationObserver.prototype, 'disconnect');
    const settings = document.createElement('button');
    settings.setAttribute('aria-label', 'Editor settings');
    const resetAction = document.createElement('button');
    resetAction.setAttribute('role', 'menuitem');
    resetAction.textContent = 'Reset to Default Code Definition';
    const actionClick = vi.fn();
    settings.addEventListener('click', () => document.body.append(resetAction));
    resetAction.addEventListener('click', actionClick);
    document.body.append(settings);

    const dispose = waitForEditorAndReset();
    expect(actionClick).toHaveBeenCalledOnce();

    await vi.advanceTimersByTimeAsync(RESET_CONFIRMATION_TIMEOUT_MS);
    expect(disconnect).toHaveBeenCalled();
    dispose();
  });

  it('waits for editor UI after SPA navigation and only resets a due decision', async () => {
    history.replaceState({}, '', '/problems/first-problem/');
    vi.mocked(sendMessage)
      .mockResolvedValueOnce({ shouldClear: false })
      .mockResolvedValueOnce({ shouldClear: true, questionFrontendId: '2' });

    const dispose = setupClearEditorOnReview();
    await vi.waitFor(() => expect(sendMessage).toHaveBeenCalledOnce());

    history.pushState({}, '', '/problems/second-problem/description/');
    await vi.waitFor(() => expect(sendMessage).toHaveBeenCalledTimes(2));

    const settings = document.createElement('button');
    settings.title = 'Code settings';
    const resetAction = document.createElement('button');
    resetAction.setAttribute('role', 'menuitem');
    resetAction.textContent = 'Reset to Default Code Definition';
    const settingsClick = vi.fn(() => document.body.append(resetAction));
    const resetClick = vi.fn();
    settings.addEventListener('click', settingsClick);
    resetAction.addEventListener('click', resetClick);
    document.body.append(settings);

    await vi.waitFor(() => expect(resetClick).toHaveBeenCalledOnce());
    expect(settingsClick).toHaveBeenCalledOnce();
    expect(sendMessage).toHaveBeenLastCalledWith({
      type: 'GET_CLEAR_EDITOR_ON_REVIEW_DECISION',
      slug: 'second-problem',
      domain: 'leetcode.com',
    });
    dispose();
  });

  it('uses the path slug rather than a stale Next router slug after navigation', async () => {
    history.replaceState({}, '', '/problems/first-problem/');
    Object.defineProperty(window, 'next', {
      configurable: true,
      value: { router: { query: { slug: 'first-problem' } } },
    });
    vi.mocked(sendMessage).mockResolvedValue({ shouldClear: false });

    const dispose = setupClearEditorOnReview();
    await vi.waitFor(() => expect(sendMessage).toHaveBeenCalledOnce());

    history.pushState({}, '', '/problems/second-problem/description/');
    await vi.waitFor(() => expect(sendMessage).toHaveBeenCalledTimes(2));

    expect(sendMessage).toHaveBeenLastCalledWith({
      type: 'GET_CLEAR_EDITOR_ON_REVIEW_DECISION',
      slug: 'second-problem',
      domain: 'leetcode.com',
    });
    dispose();
  });

  it('does not wait for or open the editor when the decision is not due', async () => {
    history.replaceState({}, '', '/problems/not-due/');
    vi.mocked(sendMessage).mockResolvedValue({ shouldClear: false });
    const settings = document.createElement('button');
    settings.setAttribute('aria-label', 'Editor settings');
    const settingsClick = vi.fn();
    settings.addEventListener('click', settingsClick);
    document.body.append(settings);

    const dispose = setupClearEditorOnReview();
    await vi.waitFor(() => expect(sendMessage).toHaveBeenCalledOnce());

    expect(settingsClick).not.toHaveBeenCalled();
    dispose();
  });
});
