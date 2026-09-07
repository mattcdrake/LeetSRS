// @vitest-environment happy-dom
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, expect, it, vi } from 'vitest';
import { translations } from '@/i18n';
import { watchStoredTranslations } from '@/infrastructure/storage/translations';

vi.mock('@/infrastructure/storage/translations', () => ({ watchStoredTranslations: vi.fn() }));
const unwatch = vi.fn();
beforeEach(() => {
  vi.mocked(watchStoredTranslations).mockImplementation((onChange) => {
    onChange(translations.en);
    return unwatch;
  });
});

import { LeetSrsControl } from '../LeetSrsControl';

function setup() {
  const onRate = vi.fn();
  const onAddWithoutRating = vi.fn();
  const view = render(<LeetSrsControl onRate={onRate} onAddWithoutRating={onAddWithoutRating} />);
  return { ...view, onRate, onAddWithoutRating, button: screen.getByRole('button', { name: 'LeetSRS' }) };
}

it('toggles the menu and dispatches selections exactly once before closing', async () => {
  const { button, onRate, onAddWithoutRating } = setup();
  expect(button).toHaveAttribute('type', 'button');
  fireEvent.click(button);
  fireEvent.click(await screen.findByRole('button', { name: translations.en.ratings.good }));
  expect(onRate).toHaveBeenCalledExactlyOnceWith(3, translations.en.ratings.good);
  expect(button).toHaveAttribute('aria-expanded', 'false');
  fireEvent.click(button);
  fireEvent.click(await screen.findByRole('button', { name: translations.en.contentScript.addToSrsNoRating }));
  expect(onAddWithoutRating).toHaveBeenCalledOnce();
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
  fireEvent.click(document.body);
  expect(button).toHaveAttribute('aria-expanded', 'false');
  fireEvent.click(button);
  await screen.findByRole('button', { name: translations.en.ratings.good });
});

it('updates an open menu when stored language changes without resubscribing on clicks', () => {
  const { button, onRate, unmount } = setup();
  fireEvent.click(button);
  const onChange = vi.mocked(watchStoredTranslations).mock.calls[0][0];
  act(() => onChange(translations.pl));
  fireEvent.click(screen.getByRole('button', { name: translations.pl.ratings.good }));
  expect(onRate).toHaveBeenCalledExactlyOnceWith(3, translations.pl.ratings.good);
  fireEvent.click(button);
  expect(watchStoredTranslations).toHaveBeenCalledOnce();
  unmount();
  expect(unwatch).toHaveBeenCalledOnce();
});

it('owns the tooltip portal and removes it on mouse leave or unmount', async () => {
  const { button, unmount } = setup();
  fireEvent.mouseEnter(button);
  expect(await screen.findByRole('tooltip')).toHaveTextContent('LeetSRS');
  fireEvent.mouseLeave(button);
  expect(screen.queryByRole('tooltip')).not.toBeInTheDocument();
  fireEvent.mouseEnter(button);
  await screen.findByRole('tooltip');
  unmount();
  await waitFor(() => expect(screen.queryByRole('tooltip')).not.toBeInTheDocument());
});
