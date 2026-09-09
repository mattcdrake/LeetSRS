// @vitest-environment happy-dom

import { fireEvent, render, screen } from '@testing-library/react';
import { Rating } from 'ts-fsrs';
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
  ).toEqual([t.ratings[Rating.Again], t.ratings[Rating.Hard], t.ratings[Rating.Good], t.ratings[Rating.Easy]]);
  [t.ratings[Rating.Again], t.ratings[Rating.Hard], t.ratings[Rating.Good], t.ratings[Rating.Easy]].forEach(
    (label, index) => {
      const button = screen.getByRole('button', { name: label });
      expect(button.style.getPropertyValue('--button-bg')).toBe(['#c73e3e', '#d97706', '#4271c4', '#3d9156'][index]);
      fireEvent.click(button);
      expect(onRate).toHaveBeenLastCalledWith(index + 1);
      expect(onRate).toHaveBeenCalledTimes(index + 1);
    }
  );
  fireEvent.click(screen.getByRole('button', { name: t.contentScript.addToSrsNoRating }));
  expect(onRate).toHaveBeenCalledTimes(4);
  expect(onAddWithoutRating).toHaveBeenCalledOnce();
  expect(onSelect).toHaveBeenCalledTimes(5);
});
