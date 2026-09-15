// @vitest-environment happy-dom

import { act, fireEvent, render, screen } from '@testing-library/react';
import { Rating } from 'ts-fsrs';
import { beforeEach, expect, it, vi } from 'vitest';
import { addCurrentProblem, rateCurrentProblem } from '@/content/rating-actions';
import { watchDocumentTranslations } from '@/content/translations';
import { translations } from '@/shared/i18n/index';

vi.mock('@/content/translations', () => ({
  watchDocumentTranslations: vi.fn(),
}));
vi.mock('@/content/rating-actions', () => ({ addCurrentProblem: vi.fn(), rateCurrentProblem: vi.fn() }));
const unwatch = vi.fn();
beforeEach(() => {
  vi.mocked(watchDocumentTranslations).mockImplementation((onChange) => {
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
  fireEvent.click(await screen.findByRole('button', { name: translations.en.ratings[Rating.Good] }));
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
  await screen.findByRole('button', { name: translations.en.ratings[Rating.Good] });
  fireEvent.click(button);
  expect(button).toHaveAttribute('aria-expanded', 'false');
});

it('updates an open menu when stored language changes without resubscribing on clicks', () => {
  const { button, unmount } = setup();
  fireEvent.click(button);
  const onChange = vi.mocked(watchDocumentTranslations).mock.calls[0][0];
  act(() => onChange(translations['zh-CN']));
  fireEvent.click(screen.getByRole('button', { name: translations['zh-CN'].ratings[Rating.Good] }));
  fireEvent.click(button);
  expect(watchDocumentTranslations).toHaveBeenCalledOnce();
  unmount();
  expect(unwatch).toHaveBeenCalledOnce();
});

it('shows an error when saving a review fails', async () => {
  vi.spyOn(console, 'error').mockImplementation(() => {});
  vi.mocked(rateCurrentProblem).mockRejectedValueOnce(new Error('Unknown problem'));
  const { button } = setup();
  fireEvent.click(button);
  fireEvent.click(await screen.findByRole('button', { name: 'Good' }));
  expect(await screen.findByRole('status')).toHaveTextContent('Could not save this problem. Please try again.');
});
