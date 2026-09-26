// @vitest-environment happy-dom

import { act, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fakeBrowser } from 'wxt/testing/fake-browser';
import { ContentScriptContext } from 'wxt/utils/content-script-context';
import { setupLeetcodeEditorReset } from '@/content/editor-reset';
import { watchDocumentTranslations } from '@/content/translations';
import { translations } from '@/shared/i18n/index';
import { replaceLearningDocument } from '@/shared/learning-document';
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
    expect(document.querySelector('leetsrs-toast')).toBeNull();

    const baselineTimers = vi.getTimerCount();
    const [onResetConfirmed] = requireDefined(vi.mocked(setupLeetcodeEditorReset).mock.calls[0]);
    await act(async () => onResetConfirmed());

    const container = requireDefined(document.querySelector('leetsrs-toast'));
    const toast = requireDefined(container.shadowRoot?.querySelector('[role="status"]'));
    expect(toast).toHaveTextContent('Code reset for today’s review');
    act(() => vi.advanceTimersByTime(4000));
    expect(container.isConnected).toBe(true);
    act(() => vi.advanceTimersByTime(200));
    expect(container.isConnected).toBe(false);
    expect(vi.getTimerCount()).toBe(baselineTimers);
  });

  it('checks whether to reset once per problem visit', async () => {
    history.replaceState({}, '', '/problemset/');
    await act(() => bootstrapContent(ctx));
    vi.mocked(setupLeetcodeEditorReset).mockClear();
    disposeReset.mockClear();

    history.pushState({}, '', '/problems/two-sum/description/');
    act(() => notifyMutation());
    expect(setupLeetcodeEditorReset).toHaveBeenCalledTimes(1);
    expect(disposeReset).toHaveBeenCalledTimes(1);

    history.replaceState({}, '', '/problems/two-sum/');
    act(() => notifyMutation());
    act(() => notifyMutation());
    expect(setupLeetcodeEditorReset).toHaveBeenCalledTimes(1);
    expect(disposeReset).toHaveBeenCalledTimes(1);

    history.pushState({}, '', '/problems/add-two-numbers/');
    act(() => notifyMutation());
    expect(setupLeetcodeEditorReset).toHaveBeenCalledTimes(2);
    expect(disposeReset).toHaveBeenCalledTimes(2);

    act(() => ctx.notifyInvalidated());
    expect(disposeReset).toHaveBeenCalledTimes(3);
  });

  it('mounts late and replaced toolbars without duplicates and unmounts when they disappear', async () => {
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

    unwatchTranslations.mockClear();
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

    const toolbar = requireDefined(document.querySelector('#ide-top-btns'));
    toolbar.remove();

    act(() => notifyMutation());

    expect(toolbar.querySelector('#leetsrs-control')).toBeNull();
    expect(unwatchTranslations).toHaveBeenCalledTimes(2);
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
