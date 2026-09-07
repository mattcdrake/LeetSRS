// @vitest-environment happy-dom
import { act, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { Tooltip } from '../Tooltip';

beforeEach(() => vi.useFakeTimers());
afterEach(() => {
  vi.useRealTimers();
  document.documentElement.classList.remove('dark');
});

function anchor() {
  const target = document.createElement('button');
  vi.spyOn(target, 'getBoundingClientRect').mockReturnValue(new DOMRect(100, 100, 50, 20));
  return target;
}

it('waits 300ms and positions below the center of the target', () => {
  render(<Tooltip target={anchor()} text="LeetSRS" />);
  act(() => vi.advanceTimersByTime(299));
  expect(screen.queryByRole('tooltip')).not.toBeInTheDocument();
  act(() => vi.advanceTimersByTime(1));
  expect(screen.getByRole('tooltip')).toHaveTextContent('LeetSRS');
  expect(screen.getByRole('tooltip')).toHaveStyle({
    left: '125px',
    top: '128px',
    backgroundColor: 'white',
  });
});

it('cancels pending display on unmount', () => {
  const target = anchor();
  const { unmount } = render(<Tooltip target={target} text="LeetSRS" />);
  unmount();
  act(() => vi.advanceTimersByTime(300));
  expect(target.getBoundingClientRect).not.toHaveBeenCalled();
  expect(screen.queryByRole('tooltip')).not.toBeInTheDocument();
});

it('restarts the delay when content changes and applies the dark theme', () => {
  document.documentElement.classList.add('dark');
  const target = anchor();
  const { rerender } = render(<Tooltip target={target} text="First" />);
  act(() => vi.advanceTimersByTime(300));
  rerender(<Tooltip target={target} text="Second" />);
  expect(screen.queryByRole('tooltip')).not.toBeInTheDocument();
  act(() => vi.advanceTimersByTime(300));
  expect(screen.getAllByRole('tooltip')).toHaveLength(1);
  expect(screen.getByRole('tooltip')).toHaveTextContent('Second');
  expect(screen.getByRole('tooltip')).toHaveStyle({ backgroundColor: 'rgb(40, 40, 40)' });
});
