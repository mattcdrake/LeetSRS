// @vitest-environment happy-dom

import { act, cleanup, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Toast } from '../Toast';

describe('Toast', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => {
    cleanup();
    vi.useRealTimers();
  });

  it('renders text, fades in, then fades out before requesting dismissal', () => {
    const onDismiss = vi.fn();
    render(<Toast message="Code reset <b>to default</b>" onDismiss={onDismiss} />);
    const toast = screen.getByRole('status');
    expect(toast).toHaveTextContent('Code reset <b>to default</b>');
    expect(toast.querySelector('b')).toBeNull();
    expect(toast).toHaveStyle({ opacity: '0' });

    act(() => vi.advanceTimersByTime(100));
    expect(toast).toHaveStyle({ opacity: '1' });
    act(() => vi.advanceTimersByTime(2399));
    expect(toast).toHaveStyle({ opacity: '1' });
    act(() => vi.advanceTimersByTime(1));
    expect(toast).toHaveStyle({ opacity: '0' });
    expect(onDismiss).not.toHaveBeenCalled();
    act(() => vi.advanceTimersByTime(299));
    expect(onDismiss).not.toHaveBeenCalled();
    act(() => vi.advanceTimersByTime(1));
    expect(onDismiss).toHaveBeenCalledOnce();
  });

  it.each([0, 100, 2500])('cancels pending work when unmounted at %i ms', (elapsed) => {
    const onDismiss = vi.fn();
    const { unmount } = render(<Toast message="Code reset to default" onDismiss={onDismiss} />);
    act(() => vi.advanceTimersByTime(elapsed));
    unmount();

    expect(vi.getTimerCount()).toBe(0);
    act(() => vi.advanceTimersByTime(3000));
    expect(onDismiss).not.toHaveBeenCalled();
  });
});
