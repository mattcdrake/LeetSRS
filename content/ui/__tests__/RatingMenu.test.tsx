// @vitest-environment happy-dom
import { fireEvent, render, screen } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import { translations } from '@/i18n';
import { RatingMenu } from '../RatingMenu';
import { THEME_COLORS } from '../theme';

afterEach(() => document.documentElement.classList.remove('dark'));

it.each(['en', 'pl'] as const)('dispatches each rating and add action once in %s', (language) => {
  const t = translations[language];
  const onRate = vi.fn();
  const onAddWithoutRating = vi.fn();
  const onSelect = vi.fn();
  render(<RatingMenu t={t} onRate={onRate} onAddWithoutRating={onAddWithoutRating} onSelect={onSelect} />);
  [t.ratings.again, t.ratings.hard, t.ratings.good, t.ratings.easy].forEach((label, index) => {
    fireEvent.click(screen.getByRole('button', { name: label }));
    expect(onRate).toHaveBeenLastCalledWith(index + 1, label);
  });
  fireEvent.click(screen.getByRole('button', { name: t.contentScript.addToSrsNoRating }));
  expect(onRate).toHaveBeenCalledTimes(4);
  expect(onAddWithoutRating).toHaveBeenCalledOnce();
  expect(onSelect).toHaveBeenCalledTimes(5);
});

it('updates translated labels on rerender and uses dark colors', () => {
  document.documentElement.classList.add('dark');
  const actions = { onRate: vi.fn(), onAddWithoutRating: vi.fn(), onSelect: vi.fn() };
  const { rerender } = render(<RatingMenu t={translations.en} {...actions} />);
  expect(screen.getByRole('button', { name: translations.en.ratings.again })).toHaveStyle({
    '--button-bg': THEME_COLORS.dark.ratingAgain,
  });
  rerender(<RatingMenu t={translations.pl} {...actions} />);
  fireEvent.click(screen.getByRole('button', { name: translations.pl.ratings.good }));
  expect(actions.onRate).toHaveBeenCalledWith(3, translations.pl.ratings.good);
});
