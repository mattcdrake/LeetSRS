// @vitest-environment happy-dom
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, expect, it, vi } from 'vitest';
import { addCurrentProblem, rateCurrentProblem } from '@/content/rating-actions';
import { translations } from '@/i18n';
import { watchStoredTranslations } from '@/infrastructure/storage/translations';

vi.mock('@/infrastructure/storage/translations', () => ({
  watchStoredTranslations: vi.fn(),
}));
vi.mock('@/content/rating-actions', () => ({ addCurrentProblem: vi.fn(), rateCurrentProblem: vi.fn() }));
const unwatch = vi.fn();
beforeEach(() => {
  vi.mocked(watchStoredTranslations).mockImplementation((onChange) => {
    onChange(translations.en);
    return unwatch;
  });
});

import { LeetSrsControl } from '../LeetSrsControl';

function setup() {
  const view = render(<LeetSrsControl />);
  return { ...view, button: screen.getByRole('button', { name: 'LeetSRS' }) };
}

it('toggles the menu and dispatches selections exactly once before closing', async () => {
  const { button } = setup();
  expect(button).toHaveAttribute('type', 'button');
  fireEvent.click(button);
  fireEvent.click(await screen.findByRole('button', { name: translations.en.ratings.good }));
  expect(rateCurrentProblem).toHaveBeenCalledExactlyOnceWith(3);
  expect(addCurrentProblem).not.toHaveBeenCalled();
  expect(button).toHaveAttribute('aria-expanded', 'false');
  fireEvent.click(button);
  fireEvent.click(
    await screen.findByRole('button', {
      name: translations.en.contentScript.addToSrsNoRating,
    })
  );
  expect(addCurrentProblem).toHaveBeenCalledExactlyOnceWith();
  expect(rateCurrentProblem).toHaveBeenCalledOnce();
  expect(button).toHaveAttribute('aria-expanded', 'false');
  fireEvent.click(button);
  await screen.findByRole('button', { name: translations.en.ratings.good });
  fireEvent.click(button);
  expect(button).toHaveAttribute('aria-expanded', 'false');
});

it('dismisses outside clicks and reopens', async () => {
  const { button } = setup();
  fireEvent.click(button);
  await screen.findByRole('button', { name: translations.en.ratings.good });
  fireEvent.pointerDown(document.body, { pointerType: 'mouse', button: 0 });
  fireEvent.pointerUp(document.body, { pointerType: 'mouse', button: 0 });
  fireEvent.click(document.body);
  expect(button).toHaveAttribute('aria-expanded', 'false');
  fireEvent.click(button);
  await screen.findByRole('button', { name: translations.en.ratings.good });
});

it.each(['Enter', ' '])('opens with %s, dismisses with Escape, and returns focus to the trigger', async (key) => {
  const { button } = setup();
  act(() => button.focus());
  fireEvent.keyDown(button, { key, code: key === ' ' ? 'Space' : 'Enter' });
  fireEvent.keyUp(button, { key, code: key === ' ' ? 'Space' : 'Enter' });

  const dialog = await screen.findByRole('dialog', { name: 'LeetSRS' });
  await waitFor(() => expect(dialog.contains(document.activeElement)).toBe(true));
  fireEvent.keyDown(document.activeElement ?? dialog, { key: 'Escape' });

  await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
  await waitFor(() => expect(button).toHaveFocus());
  expect(rateCurrentProblem).not.toHaveBeenCalled();
  expect(addCurrentProblem).not.toHaveBeenCalled();
});

it('keeps inside interactions open and removes the popover on unmount', async () => {
  const { button, unmount } = setup();
  fireEvent.click(button);
  const dialog = await screen.findByRole('dialog');
  fireEvent.pointerDown(dialog, { pointerType: 'mouse', button: 0 });
  fireEvent.click(dialog);
  expect(button).toHaveAttribute('aria-expanded', 'true');

  unmount();
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  expect(rateCurrentProblem).not.toHaveBeenCalled();
  expect(addCurrentProblem).not.toHaveBeenCalled();
});

it('cycles focus through every choice with Tab after opening with the mouse', async () => {
  const { button } = setup();
  fireEvent.pointerDown(button, { pointerType: 'mouse', button: 0 });
  fireEvent.pointerUp(button, { pointerType: 'mouse', button: 0 });
  fireEvent.click(button);

  const dialog = await screen.findByRole('dialog');
  await waitFor(() => expect(dialog.contains(document.activeElement)).toBe(true));
  const choices = Array.from(dialog.querySelectorAll('button'));
  // Pointer opening may focus the dialog itself or its first choice.
  if (document.activeElement === dialog) fireEvent.keyDown(dialog, { key: 'Tab' });
  expect(choices[0]).toHaveFocus();

  for (const choice of [...choices.slice(1), choices[0]]) {
    fireEvent.keyDown(document.activeElement ?? dialog, { key: 'Tab' });
    expect(choice).toHaveFocus();
    expect(choice).toHaveAttribute('data-focused', 'true');
  }
  expect(rateCurrentProblem).not.toHaveBeenCalled();
  expect(addCurrentProblem).not.toHaveBeenCalled();
});

it('updates an open menu when stored language changes without resubscribing on clicks', () => {
  const { button, unmount } = setup();
  fireEvent.click(button);
  const onChange = vi.mocked(watchStoredTranslations).mock.calls[0][0];
  act(() => onChange(translations.pl));
  fireEvent.click(screen.getByRole('button', { name: translations.pl.ratings.good }));
  fireEvent.click(button);
  expect(watchStoredTranslations).toHaveBeenCalledOnce();
  unmount();
  expect(unwatch).toHaveBeenCalledOnce();
});

it('owns the tooltip portal and removes it on mouse leave or unmount', async () => {
  const { button, unmount } = setup();
  fireEvent.pointerMove(document.body, { pointerType: 'mouse' });
  fireEvent.pointerEnter(button, { pointerType: 'mouse' });
  expect(await screen.findByRole('tooltip')).toHaveTextContent('LeetSRS');
  fireEvent.pointerLeave(button, { pointerType: 'mouse' });
  expect(screen.queryByRole('tooltip')).not.toBeInTheDocument();
  fireEvent.pointerMove(document.body, { pointerType: 'mouse' });
  fireEvent.pointerEnter(button, { pointerType: 'mouse' });
  await screen.findByRole('tooltip');
  unmount();
  await waitFor(() => expect(screen.queryByRole('tooltip')).not.toBeInTheDocument());
});
