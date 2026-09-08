// @vitest-environment happy-dom
import { fireEvent, render, screen } from '@testing-library/react';
import { expect, it, vi } from 'vitest';
import { translations } from '@/i18n';
import { RatingMenu } from '../RatingMenu';

it.each(['en', 'pl'] as const)('dispatches each rating and add action once in %s', (language) => {
  const t = translations[language];
  const onRate = vi.fn();
  const onAddWithoutRating = vi.fn();
  const onSelect = vi.fn();
  render(<RatingMenu t={t} onRate={onRate} onAddWithoutRating={onAddWithoutRating} onSelect={onSelect} />);
  expect(
    screen
      .getAllByRole('button')
      .slice(0, 4)
      .map((button) => button.textContent)
  ).toEqual([t.ratings.again, t.ratings.hard, t.ratings.good, t.ratings.easy]);
  [t.ratings.again, t.ratings.hard, t.ratings.good, t.ratings.easy].forEach((label, index) => {
    fireEvent.click(screen.getByRole('button', { name: label }));
    expect(onRate).toHaveBeenLastCalledWith(index + 1);
    expect(onRate).toHaveBeenCalledTimes(index + 1);
  });
  fireEvent.click(screen.getByRole('button', { name: t.contentScript.addToSrsNoRating }));
  expect(onRate).toHaveBeenCalledTimes(4);
  expect(onAddWithoutRating).toHaveBeenCalledOnce();
  expect(onSelect).toHaveBeenCalledTimes(5);
});
