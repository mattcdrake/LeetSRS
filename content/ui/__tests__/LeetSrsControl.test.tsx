// @vitest-environment happy-dom
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { expect, it, vi } from 'vitest';
import { translations } from '@/i18n';
import { createDeferred } from '@/test/utils/deferred';
import { LeetSrsControl } from '../LeetSrsControl';

function setup(getTranslations = vi.fn().mockResolvedValue(translations.en)) {
  const onRate = vi.fn();
  const onAddWithoutRating = vi.fn();
  const view = render(
    <LeetSrsControl
      t={translations.en}
      getTranslations={getTranslations}
      onError={vi.fn()}
      onRate={onRate}
      onAddWithoutRating={onAddWithoutRating}
    />
  );
  return { ...view, onRate, onAddWithoutRating, button: screen.getByRole('button', { name: 'LeetSRS' }) };
}

it('toggles the menu and dispatches selections exactly once before closing', async () => {
  const { button, onRate, onAddWithoutRating } = setup();
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

it('cancels an opening menu when clicking outside before translations arrive', async () => {
  const request = createDeferred<typeof translations.en>();
  const { button } = setup(vi.fn(() => request.promise));
  fireEvent.click(button);
  fireEvent.click(document.body);
  await act(async () => request.resolve(translations.en));
  expect(button).toHaveAttribute('aria-expanded', 'false');
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
