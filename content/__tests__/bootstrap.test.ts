// @vitest-environment happy-dom

import { act } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { setupLeetcodeAutoReset } from '@/content/auto-reset';
import { translations } from '@/i18n';
import { sendMessage } from '@/infrastructure/browser/messages';
import { watchStoredTranslations } from '@/infrastructure/storage/translations';
import { createDeferred } from '@/test/utils/deferred';
import { bootstrapContent } from '../bootstrap';

vi.mock('@/content/auto-reset', () => ({ setupLeetcodeAutoReset: vi.fn() }));
vi.mock('@/infrastructure/storage/translations', () => ({ watchStoredTranslations: vi.fn() }));
vi.mock('@/infrastructure/browser/messages', () => ({ sendMessage: vi.fn() }));

let notifyMutation: () => void;
const observe = vi.fn();
const disconnect = vi.fn();
const disposeReset = vi.fn();

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
    return vi.fn();
  });
  vi.mocked(setupLeetcodeAutoReset).mockReturnValue(disposeReset);
});

afterEach(() => {
  act(() => {
    document.body.innerHTML = '';
    act(() => notifyMutation());
  });
  vi.unstubAllGlobals();
});

describe('content startup', () => {
  it('waits for ping before mounting, observing, and setting up auto-reset', async () => {
    const ping = createDeferred<void>();
    vi.mocked(sendMessage).mockReturnValue(ping.promise);
    observe.mockImplementation(() => {
      expect(document.querySelector('#leetsrs-button-wrapper')).not.toBeNull();
      expect(setupLeetcodeAutoReset).not.toHaveBeenCalled();
    });

    const startup = bootstrapContent();
    expect(sendMessage).toHaveBeenCalledWith('ping');
    expect(document.querySelector('#leetsrs-button-wrapper')).toBeNull();
    ping.resolve();

    await act(async () => {
      await expect(startup).resolves.toBeUndefined();
    });
    expect(observe).toHaveBeenCalledWith(document.body, { childList: true, subtree: true });
    expect(setupLeetcodeAutoReset).toHaveBeenCalledOnce();
    expect(disposeReset).not.toHaveBeenCalled();
    expect(disconnect).not.toHaveBeenCalled();
    expect(document.querySelector('#last-group')?.previousElementSibling?.id).toBe('leetsrs-button-wrapper');
  });

  it('logs a failed ping and continues startup', async () => {
    const error = new Error('worker unavailable');
    const log = vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.mocked(sendMessage).mockRejectedValue(error);

    await act(() => bootstrapContent());

    expect(log).toHaveBeenCalledWith('Failed to ping service worker:', error);
    expect(document.querySelector('#leetsrs-button-wrapper')).not.toBeNull();
    expect(setupLeetcodeAutoReset).toHaveBeenCalledOnce();
  });

  it('mounts a late toolbar and avoids duplicates on later mutations', async () => {
    document.body.innerHTML = '';
    await act(() => bootstrapContent());
    expect(document.querySelector('#leetsrs-button-wrapper')).toBeNull();

    document.body.innerHTML = '<div id="ide-top-btns"><div id="last-group"></div></div>';
    act(() => notifyMutation());
    act(() => notifyMutation());

    expect(document.querySelectorAll('#leetsrs-button-wrapper')).toHaveLength(1);
    document.querySelector('#leetsrs-button-wrapper')?.remove();
    act(() => notifyMutation());
    expect(document.querySelectorAll('#leetsrs-button-wrapper')).toHaveLength(1);
  });
});
