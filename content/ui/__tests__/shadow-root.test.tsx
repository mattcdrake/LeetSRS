// @vitest-environment happy-dom

import { act, fireEvent, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { translations } from '@/i18n';
import { watchStoredTranslations } from '@/infrastructure/storage/translations';
import { requireDefined } from '@/test/utils/assertions';
import { LeetSrsControl } from '../LeetSrsControl';
import { createContentRoot } from '../shadow-root';

vi.mock('@/infrastructure/storage/translations', () => ({ watchStoredTranslations: vi.fn() }));
vi.mock('@/infrastructure/browser/messages', () => ({ sendMessage: vi.fn() }));

let root: ReturnType<typeof createContentRoot>;
let host: HTMLElement;
beforeEach(() => {
  vi.mocked(watchStoredTranslations).mockImplementation((onChange) => {
    onChange(translations.en);
    return vi.fn();
  });
  host = document.createElement('div');
  document.body.append(host);
  const shadow = host.attachShadow({ mode: 'open' });
  const container = document.createElement('div');
  shadow.append(container);
  root = createContentRoot(container);
  act(() => root.render(<LeetSrsControl />));
});
afterEach(() => {
  act(() => root.unmount());
  host.remove();
  document.documentElement.className = '';
});

it('isolates the control and its menu, restores focus, and dismisses outside clicks', async () => {
  const shadow = requireDefined(host.shadowRoot);
  const control = requireDefined(shadow.querySelector<HTMLElement>('div'));
  const queries = within(control);
  const button = queries.getByRole('button', { name: 'LeetSRS' });
  expect(screen.queryByRole('button', { name: 'LeetSRS' })).not.toBeInTheDocument();

  act(() => button.focus());
  fireEvent.click(button);
  const portals = requireDefined(shadow.querySelector<HTMLElement>('[popover="manual"]'));
  const dialog = await within(portals).findByRole('dialog');
  expect(dialog.getRootNode()).toBe(shadow);
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  await waitFor(() => expect(dialog.contains(shadow.activeElement)).toBe(true));
  // Happy DOM retargets composed keyboard events before React handles them.
  // Chrome's composed events are covered by the browser interaction check.
  fireEvent.keyDown(shadow.activeElement ?? dialog, { key: 'Escape', composed: false });
  await waitFor(() => expect(within(portals).queryByRole('dialog')).not.toBeInTheDocument());
  await waitFor(() => expect(shadow.activeElement).toBe(button));

  fireEvent.click(button);
  await within(portals).findByRole('dialog');
  fireEvent.pointerDown(document.body, { pointerType: 'mouse', button: 0 });
  fireEvent.pointerUp(document.body, { pointerType: 'mouse', button: 0 });
  fireEvent.click(document.body);
  await waitFor(() => expect(within(portals).queryByRole('dialog')).not.toBeInTheDocument());
});

it('keeps tooltips in the trigger shadow root and removes them on unmount', async () => {
  const shadow = requireDefined(host.shadowRoot);
  const button = requireDefined(shadow.querySelector('button'));
  fireEvent.pointerMove(document.body, { pointerType: 'mouse' });
  fireEvent.pointerEnter(button, { pointerType: 'mouse' });
  await waitFor(() => expect(shadow.querySelector('[role="tooltip"]')).not.toBeNull());
  const tooltip = requireDefined(shadow.querySelector('[role="tooltip"]'));
  expect(button).toHaveAttribute('aria-describedby', tooltip.id);
  expect(screen.queryByRole('tooltip')).not.toBeInTheDocument();

  act(() => root.render(null));
  expect(shadow.querySelector('[role="tooltip"]')).toBeNull();
});
