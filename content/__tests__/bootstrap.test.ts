// @vitest-environment happy-dom

import { act } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { setupLeetcodeAutoReset } from '@/content/auto-reset';
import { translations } from '@/i18n';
import { sendMessage } from '@/infrastructure/browser/messages';
import { watchStoredTranslations } from '@/infrastructure/storage/translations';
import { requireDefined } from '@/test/utils/assertions';
import { bootstrapContent } from '../bootstrap';

vi.mock('@/content/auto-reset', () => ({ setupLeetcodeAutoReset: vi.fn() }));
vi.mock('@/infrastructure/storage/translations', () => ({ watchStoredTranslations: vi.fn() }));
vi.mock('@/infrastructure/browser/messages', () => ({ sendMessage: vi.fn() }));

let notifyMutation: () => void;
const observe = vi.fn();
const disconnect = vi.fn();
const disposeReset = vi.fn();
const unwatchTranslations = vi.fn();

beforeEach(() => {
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
  vi.mocked(sendMessage).mockResolvedValue(undefined);
  vi.mocked(watchStoredTranslations).mockImplementation((onChange) => {
    onChange(translations.en);
    return unwatchTranslations;
  });
  vi.mocked(setupLeetcodeAutoReset).mockReturnValue(disposeReset);
});

afterEach(() => {
  act(() => {
    document.body.innerHTML = '';
    notifyMutation();
  });
  vi.unstubAllGlobals();
});

describe('content startup', () => {
  it('mounts, observes, and sets up auto-reset without messaging the worker', async () => {
    await act(() => bootstrapContent());

    expect(sendMessage).not.toHaveBeenCalled();
    expect(observe).toHaveBeenCalledWith(document.body, { childList: true, subtree: true });
    expect(setupLeetcodeAutoReset).toHaveBeenCalledOnce();
    expect(disposeReset).not.toHaveBeenCalled();
    expect(disconnect).not.toHaveBeenCalled();
    expect(document.querySelector('#last-group')?.previousElementSibling?.id).toBe('leetsrs-control');
  });

  it('mounts a late toolbar and avoids duplicates on later mutations', async () => {
    document.body.innerHTML = '';
    await act(() => bootstrapContent());
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
    await act(() => bootstrapContent());
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
    await act(() => bootstrapContent());
    const toolbar = requireDefined(document.querySelector('#ide-top-btns'));
    toolbar.remove();

    act(() => notifyMutation());

    expect(toolbar.querySelector('#leetsrs-control')).toBeNull();
    expect(unwatchTranslations).toHaveBeenCalledOnce();
  });
});
