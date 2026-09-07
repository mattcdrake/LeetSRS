// @vitest-environment happy-dom
import { fireEvent, render, screen } from '@testing-library/react';
import { expect, it, vi } from 'vitest';
import { translations } from '@/i18n';
import { LeetSrsButton } from '../LeetSrsButton';

it('renders an accessible toolbar button and dispatches once per click', () => {
  const onClick = vi.fn();
  const { rerender } = render(<LeetSrsButton t={translations.en} onClick={onClick} />);
  const button = screen.getByRole('button', { name: translations.en.app.name });
  expect(button).toHaveAttribute('type', 'button');
  expect(button).toHaveStyle({ color: '#28c244' });
  fireEvent.click(button);
  expect(onClick).toHaveBeenCalledOnce();
  const nextClick = vi.fn();
  rerender(<LeetSrsButton t={translations.pl} onClick={nextClick} />);
  fireEvent.click(screen.getByRole('button', { name: translations.pl.app.name }));
  expect(nextClick).toHaveBeenCalledOnce();
  expect(onClick).toHaveBeenCalledOnce();
});
