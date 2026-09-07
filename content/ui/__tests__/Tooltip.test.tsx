// @vitest-environment happy-dom
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { Button, TooltipTrigger } from 'react-aria-components';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { Tooltip } from '../Tooltip';

beforeEach(() => vi.useFakeTimers());
afterEach(() => {
  cleanup();
  vi.useRealTimers();
  document.documentElement.classList.remove('dark');
});

function setup() {
  return render(
    <TooltipTrigger delay={300} closeDelay={0}>
      <Button>Trigger</Button>
      <Tooltip text="LeetSRS" />
    </TooltipTrigger>
  );
}

it('waits 300ms on hover and associates the tooltip with its trigger', () => {
  setup();
  const button = screen.getByRole('button');
  fireEvent.pointerMove(document.body, { pointerType: 'mouse' });
  fireEvent.pointerEnter(button, { pointerType: 'mouse' });
  fireEvent.pointerMove(button, { pointerType: 'mouse' });
  act(() => vi.advanceTimersByTime(299));
  expect(screen.queryByRole('tooltip')).not.toBeInTheDocument();
  act(() => vi.advanceTimersByTime(1));
  expect(screen.getByRole('tooltip')).toHaveTextContent('LeetSRS');
  expect(button).toHaveAttribute('aria-describedby', screen.getByRole('tooltip').id);
  expect(screen.getByRole('tooltip')).toHaveStyle({ backgroundColor: 'white' });
  fireEvent.pointerLeave(button, { pointerType: 'mouse' });
  act(() => vi.runOnlyPendingTimers());
  expect(screen.queryByRole('tooltip')).not.toBeInTheDocument();
});

it('cancels pending display on unmount', () => {
  const { unmount } = setup();
  fireEvent.mouseEnter(screen.getByRole('button'));
  fireEvent.mouseMove(screen.getByRole('button'));
  unmount();
  act(() => vi.advanceTimersByTime(300));
  expect(screen.queryByRole('tooltip')).not.toBeInTheDocument();
});

it('supports keyboard focus and the dark theme', () => {
  document.documentElement.classList.add('dark');
  setup();
  fireEvent.keyDown(document.body, { key: 'Tab' });
  act(() => screen.getByRole('button').focus());
  act(() => vi.runOnlyPendingTimers());
  expect(screen.getByRole('tooltip')).toHaveStyle({ backgroundColor: 'rgb(40, 40, 40)' });
});
