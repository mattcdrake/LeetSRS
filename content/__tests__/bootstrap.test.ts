// @vitest-environment happy-dom

import { act, screen, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fakeBrowser } from 'wxt/testing/fake-browser';
import { ContentScriptContext } from 'wxt/utils/content-script-context';
import { setupLeetcodeEditorReset } from '@/content/editor-reset';
import { watchDocumentTranslations } from '@/content/translations';
import { translations } from '@/shared/i18n/index';
import { replaceLearningDocument } from '@/shared/storage';
import { requireDefined } from '@/test/utils/assertions';
import { buildLearningDocument } from '@/test/utils/learning-document-mocks';
import { bootstrapContent } from '../bootstrap';
import { ACCEPTED_SUBMISSION_MESSAGE } from '../submission-observer';

vi.mock('@/content/editor-reset', () => ({ setupLeetcodeEditorReset: vi.fn() }));
vi.mock('@/content/translations', () => ({ watchDocumentTranslations: vi.fn() }));

let ctx: ContentScriptContext;
let notifyMutation: () => void;
const observe = vi.fn();
const disconnect = vi.fn();
const disposeReset = vi.fn();
const unwatchTranslations = vi.fn();

beforeEach(() => {
  ctx = new ContentScriptContext('test');
  vi.stubGlobal(
    'MutationObserver',
    class {
      constructor(private readonly callback: () => void) {}
      observe(target: Node, options: MutationObserverInit) {
        if (options.childList) {
          notifyMutation = this.callback;
          observe(target, options);
        }
      }
      disconnect = disconnect;
    }
  );
  document.body.innerHTML = '<div id="ide-top-btns"><div id="last-group"></div></div>';
  vi.mocked(watchDocumentTranslations).mockImplementation((onChange) => {
    onChange(translations.en);
    return unwatchTranslations;
  });
  vi.mocked(setupLeetcodeEditorReset).mockReturnValue(disposeReset);
});

afterEach(() => {
  act(() => {
    ctx.notifyInvalidated();
    document.body.innerHTML = '';
  });
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe('content startup', () => {
  it('shows a toast only after auto-reset reports confirmation', async () => {
    vi.useFakeTimers();
    await act(() => bootstrapContent(ctx));
    expect(screen.queryByRole('status')).not.toBeInTheDocument();

    const baselineTimers = vi.getTimerCount();
    const [onResetConfirmed] = requireDefined(vi.mocked(setupLeetcodeEditorReset).mock.calls[0]);
    await act(async () => onResetConfirmed());

    const container = requireDefined(document.querySelector('leetsrs-toast'));
    const toast = requireDefined(container.shadowRoot?.querySelector('[role="status"]'));
    expect(toast).toHaveTextContent('Code reset to default');
    act(() => vi.advanceTimersByTime(2800));
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
    expect(container.isConnected).toBe(false);
    expect(vi.getTimerCount()).toBe(baselineTimers);
  });

  it('mounts a late toolbar and avoids duplicates on later mutations', async () => {
    document.body.innerHTML = '';
    await act(() => bootstrapContent(ctx));
    expect(document.querySelector('#leetsrs-control')).toBeNull();

    document.body.innerHTML = '<div id="ide-top-btns"><div id="last-group"></div></div>';
    act(() => notifyMutation());
    act(() => notifyMutation());

    expect(document.querySelectorAll('#leetsrs-control')).toHaveLength(1);
    document.querySelector('#leetsrs-control')?.remove();
    act(() => notifyMutation());
    expect(document.querySelectorAll('#leetsrs-control')).toHaveLength(1);
  });

  it('replaces the tracked mount when the old toolbar stays connected', async () => {
    await act(() => bootstrapContent(ctx));
    const oldToolbar = requireDefined(document.querySelector('#ide-top-btns'));
    oldToolbar.removeAttribute('id');
    document.body.insertAdjacentHTML('beforeend', '<div id="ide-top-btns"><div id="last-group"></div></div>');

    act(() => notifyMutation());
    act(() => notifyMutation());

    expect(oldToolbar.isConnected).toBe(true);
    expect(oldToolbar.querySelector('#leetsrs-control')).toBeNull();
    expect(document.querySelectorAll('#leetsrs-control')).toHaveLength(1);
    expect(document.querySelector('#ide-top-btns #leetsrs-control')).not.toBeNull();
    expect(unwatchTranslations).toHaveBeenCalledOnce();
  });

  it('unmounts when the toolbar disappears', async () => {
    await act(() => bootstrapContent(ctx));
    const toolbar = requireDefined(document.querySelector('#ide-top-btns'));
    toolbar.remove();

    act(() => notifyMutation());

    expect(toolbar.querySelector('#leetsrs-control')).toBeNull();
    expect(unwatchTranslations).toHaveBeenCalledOnce();
  });
});

it('ignores messages for another problem and stops on invalidation', async () => {
  fakeBrowser.reset();
  window.history.replaceState({}, '', '/problems/two-sum/');
  await replaceLearningDocument(buildLearningDocument());
  await act(() => bootstrapContent(ctx));
  const shadow = requireDefined(document.querySelector('leetsrs-control')?.shadowRoot);
  const control = requireDefined(shadow.querySelector<HTMLElement>('div'));
  const button = within(control).getByRole('button', { name: 'LeetSRS' });
  const notify = (id: string, slug = 'two-sum') =>
    window.dispatchEvent(
      new MessageEvent('message', {
        source: window,
        origin: window.location.origin,
        data: { type: ACCEPTED_SUBMISSION_MESSAGE, slug, submissionId: id },
      })
    );
  await act(async () => notify('4', 'add-two-numbers'));
  expect(button).toHaveAttribute('aria-expanded', 'false');
  act(() => ctx.notifyInvalidated());
  await act(async () => notify('5'));
  expect(document.querySelector('leetsrs-control')).toBeNull();
});
