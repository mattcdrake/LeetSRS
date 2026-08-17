/**
 * @vitest-environment happy-dom
 */
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createMutationMock } from '@/test/utils/query-mocks';
import { DataSection } from '../DataSection';
import { useExportDataMutation, useImportDataMutation, useResetAllDataMutation } from '@/hooks/useBackgroundQueries';

vi.mock('@/hooks/useBackgroundQueries', () => ({
  useExportDataMutation: vi.fn(),
  useImportDataMutation: vi.fn(),
  useResetAllDataMutation: vi.fn(),
}));

describe('DataSection reset', () => {
  const resetMutateAsync = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(useExportDataMutation).mockReturnValue(createMutationMock() as ReturnType<typeof useExportDataMutation>);
    vi.mocked(useImportDataMutation).mockReturnValue(createMutationMock() as ReturnType<typeof useImportDataMutation>);
    vi.mocked(useResetAllDataMutation).mockReturnValue(
      createMutationMock({ mutateAsync: resetMutateAsync }) as ReturnType<typeof useResetAllDataMutation>
    );
    resetMutateAsync.mockResolvedValue(undefined);
    vi.stubGlobal('confirm', vi.fn().mockReturnValue(true));
    vi.stubGlobal('alert', vi.fn());
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it('arms on the first click without opening the browser dialog', () => {
    render(<DataSection />);

    fireEvent.click(screen.getByRole('button', { name: 'Reset All Data' }));

    expect(screen.getByRole('button', { name: 'Click again to confirm' })).toBeInTheDocument();
    expect(window.confirm).not.toHaveBeenCalled();
    expect(resetMutateAsync).not.toHaveBeenCalled();
  });

  it('expires confirmation after 3000ms', () => {
    vi.useFakeTimers();
    render(<DataSection />);

    fireEvent.click(screen.getByRole('button', { name: 'Reset All Data' }));
    act(() => {
      vi.advanceTimersByTime(3000);
    });

    expect(screen.getByRole('button', { name: 'Reset All Data' })).toBeInTheDocument();
    expect(resetMutateAsync).not.toHaveBeenCalled();
  });

  it('disarms when the browser dialog is cancelled', async () => {
    vi.mocked(window.confirm).mockReturnValue(false);
    render(<DataSection />);

    fireEvent.click(screen.getByRole('button', { name: 'Reset All Data' }));
    fireEvent.click(screen.getByRole('button', { name: 'Click again to confirm' }));

    await waitFor(() => expect(screen.getByRole('button', { name: 'Reset All Data' })).toBeInTheDocument());
    expect(resetMutateAsync).not.toHaveBeenCalled();
  });

  it('resets data, alerts success, and disarms after confirmation', async () => {
    render(<DataSection />);

    fireEvent.click(screen.getByRole('button', { name: 'Reset All Data' }));
    fireEvent.click(screen.getByRole('button', { name: 'Click again to confirm' }));

    await waitFor(() => expect(resetMutateAsync).toHaveBeenCalledTimes(1));
    expect(window.alert).toHaveBeenCalledWith('All data has been reset');
    expect(screen.getByRole('button', { name: 'Reset All Data' })).toBeInTheDocument();
  });

  it('alerts the error and disarms when reset fails', async () => {
    const error = new Error('Reset failed');
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});
    resetMutateAsync.mockRejectedValue(error);
    render(<DataSection />);

    fireEvent.click(screen.getByRole('button', { name: 'Reset All Data' }));
    fireEvent.click(screen.getByRole('button', { name: 'Click again to confirm' }));

    await waitFor(() => expect(consoleError).toHaveBeenCalledWith('Reset failed:', error));
    expect(window.alert).toHaveBeenCalledWith('Failed to reset data');
    expect(screen.getByRole('button', { name: 'Reset All Data' })).toBeInTheDocument();
  });
});
