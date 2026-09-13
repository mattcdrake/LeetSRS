/**
 * @vitest-environment happy-dom
 */
import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useTimedConfirmation } from '../useTimedConfirmation';

describe('useTimedConfirmation', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('arms on the first call without running the action', async () => {
    const action = vi.fn();
    const { result } = renderHook(() => useTimedConfirmation());

    await act(async () => {
      await result.current.startOrConfirm(action);
    });

    expect(result.current.isConfirming).toBe(true);
    expect(action).not.toHaveBeenCalled();
  });

  it('runs a synchronous action once on the second call and resets', async () => {
    const action = vi.fn();
    const { result } = renderHook(() => useTimedConfirmation());

    await act(async () => {
      await result.current.startOrConfirm(action);
      await result.current.startOrConfirm(action);
    });

    expect(action).toHaveBeenCalledTimes(1);
    expect(result.current.isConfirming).toBe(false);
    expect(vi.getTimerCount()).toBe(0);
  });

  it('expires after the default 3000ms', async () => {
    const { result } = renderHook(() => useTimedConfirmation());

    await act(async () => {
      await result.current.startOrConfirm(vi.fn());
    });

    act(() => {
      vi.advanceTimersByTime(2999);
    });
    expect(result.current.isConfirming).toBe(true);

    act(() => {
      vi.advanceTimersByTime(1);
    });
    expect(result.current.isConfirming).toBe(false);
  });

  it('supports explicit cancellation', async () => {
    const { result } = renderHook(() => useTimedConfirmation());

    await act(async () => {
      await result.current.startOrConfirm(vi.fn());
    });
    act(() => {
      result.current.resetConfirmation();
    });

    expect(result.current.isConfirming).toBe(false);
    expect(vi.getTimerCount()).toBe(0);
  });

  it('stays armed until an asynchronous action settles, then cleans up', async () => {
    let resolveAction: (() => void) | undefined;
    const action = vi.fn(
      () =>
        new Promise<void>((resolve) => {
          resolveAction = resolve;
        })
    );
    const { result } = renderHook(() => useTimedConfirmation());

    await act(async () => {
      await result.current.startOrConfirm(action);
    });
    let confirmation: Promise<void> | undefined;
    act(() => {
      confirmation = result.current.startOrConfirm(action);
    });

    expect(action).toHaveBeenCalledTimes(1);
    expect(result.current.isConfirming).toBe(true);
    expect(vi.getTimerCount()).toBe(0);

    await act(async () => {
      resolveAction?.();
      await confirmation;
    });

    expect(result.current.isConfirming).toBe(false);
  });

  it('resets after an action rejects', async () => {
    const error = new Error('Action failed');
    const action = vi.fn().mockRejectedValue(error);
    const { result } = renderHook(() => useTimedConfirmation());

    await act(async () => {
      await result.current.startOrConfirm(action);
    });

    let caughtError: unknown;
    await act(async () => {
      try {
        await result.current.startOrConfirm(action);
      } catch (actionError) {
        caughtError = actionError;
      }
    });

    expect(caughtError).toBe(error);
    expect(result.current.isConfirming).toBe(false);
    expect(vi.getTimerCount()).toBe(0);
  });

  it('keeps hook instances independent', async () => {
    const first = renderHook(() => useTimedConfirmation());
    const second = renderHook(() => useTimedConfirmation());

    await act(async () => {
      await first.result.current.startOrConfirm(vi.fn());
    });

    expect(first.result.current.isConfirming).toBe(true);
    expect(second.result.current.isConfirming).toBe(false);
  });

  it('clears its timer on unmount', async () => {
    const { result, unmount } = renderHook(() => useTimedConfirmation());

    await act(async () => {
      await result.current.startOrConfirm(vi.fn());
    });
    expect(vi.getTimerCount()).toBe(1);

    unmount();

    expect(vi.getTimerCount()).toBe(0);
  });

  it('uses a custom timeout', async () => {
    const { result } = renderHook(() => useTimedConfirmation(50));

    await act(async () => {
      await result.current.startOrConfirm(vi.fn());
    });
    act(() => {
      vi.advanceTimersByTime(50);
    });

    expect(result.current.isConfirming).toBe(false);
  });
});
