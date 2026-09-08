// @vitest-environment happy-dom
import { render } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import { translations } from '@/i18n';
import { LeetSrsButton } from '../LeetSrsControl';

afterEach(() => {
  document.documentElement.className = '';
  document.body.className = '';
});

it('disconnects theme observers on unmount', () => {
  const disconnect = vi.spyOn(MutationObserver.prototype, 'disconnect');
  const { unmount } = render(<LeetSrsButton t={translations.en} onClick={vi.fn()} />);
  unmount();
  expect(disconnect).toHaveBeenCalledOnce();
});
