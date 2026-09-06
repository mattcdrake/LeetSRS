// @vitest-environment happy-dom

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { setupLeetcodeAutoReset } from '@/content/auto-reset';
import { getStoredTranslations } from '@/infrastructure/storage/translations';
import { translations } from '@/shared/i18n';
import { sendMessage } from '@/shared/messages';
import { createDeferred } from '@/test/utils/deferred';
import { bootstrapContent } from '../bootstrap';

vi.mock('@/content/auto-reset', () => ({ setupLeetcodeAutoReset: vi.fn() }));
vi.mock('@/infrastructure/storage/translations', () => ({ getStoredTranslations: vi.fn() }));
vi.mock('@/shared/messages', () => ({ sendMessage: vi.fn() }));

let notifyMutation: () => void;
const observe = vi.fn();
const disconnect = vi.fn();
const disposeReset = vi.fn();

beforeEach(() => {
  vi.stubGlobal(
    'MutationObserver',
    class {
      constructor(callback: () => void) {
        notifyMutation = callback;
      }
      observe = observe;
      disconnect = disconnect;
    }
  );
  document.body.innerHTML = '<div id="ide-top-btns"><div id="last-group"></div></div>';
  vi.mocked(sendMessage).mockResolvedValue(undefined);
  vi.mocked(getStoredTranslations).mockResolvedValue(translations.en);
  vi.mocked(setupLeetcodeAutoReset).mockReturnValue(disposeReset);
});

afterEach(() => {
  document.body.innerHTML = '';
  vi.unstubAllGlobals();
});

describe('content startup', () => {
  it('waits for ping and translations before mounting, observing, and setting up auto-reset', async () => {
    const ping = createDeferred<void>();
    const language = createDeferred<typeof translations.en>();
    vi.mocked(sendMessage).mockReturnValue(ping.promise);
    vi.mocked(getStoredTranslations).mockReturnValue(language.promise);
    observe.mockImplementation(() => {
      expect(document.querySelector('#leetsrs-button-wrapper')).not.toBeNull();
      expect(setupLeetcodeAutoReset).not.toHaveBeenCalled();
    });

    const startup = bootstrapContent();
    expect(sendMessage).toHaveBeenCalledWith('ping');
    expect(getStoredTranslations).not.toHaveBeenCalled();
    ping.resolve();
    await ping.promise;
    expect(getStoredTranslations).toHaveBeenCalledOnce();
    expect(document.querySelector('#leetsrs-button-wrapper')).toBeNull();
    expect(observe).not.toHaveBeenCalled();
    language.resolve(translations.en);

    await expect(startup).resolves.toBeUndefined();
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

    await bootstrapContent();

    expect(log).toHaveBeenCalledWith('Failed to ping service worker:', error);
    expect(document.querySelector('#leetsrs-button-wrapper')).not.toBeNull();
    expect(setupLeetcodeAutoReset).toHaveBeenCalledOnce();
  });

  it('propagates translation failure before mounting or auto-reset', async () => {
    const error = new Error('storage unavailable');
    vi.mocked(getStoredTranslations).mockRejectedValue(error);

    await expect(bootstrapContent()).rejects.toThrow(error);

    expect(document.querySelector('#leetsrs-button-wrapper')).toBeNull();
    expect(observe).not.toHaveBeenCalled();
    expect(setupLeetcodeAutoReset).not.toHaveBeenCalled();
  });

  it('mounts a late toolbar and avoids duplicates on later mutations', async () => {
    document.body.innerHTML = '';
    await bootstrapContent();
    expect(document.querySelector('#leetsrs-button-wrapper')).toBeNull();

    document.body.innerHTML = '<div id="ide-top-btns"><div id="last-group"></div></div>';
    notifyMutation();
    notifyMutation();

    expect(document.querySelectorAll('#leetsrs-button-wrapper')).toHaveLength(1);
    document.querySelector('#leetsrs-button-wrapper')?.remove();
    notifyMutation();
    expect(document.querySelectorAll('#leetsrs-button-wrapper')).toHaveLength(1);
    expect(getStoredTranslations).toHaveBeenCalledOnce();
  });
});
