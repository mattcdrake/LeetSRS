/**
 * @vitest-environment happy-dom
 */
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { sendMessage } from '@/shared/messages';
import { createMessageMock } from '@/test/utils/message-mocks';
import { createTestWrapper } from '@/test/utils/test-wrapper';
import { DataSection } from '../DataSection';

vi.mock('@/shared/messages', () => ({ sendMessage: vi.fn() }));

describe('DataSection reset', () => {
  const messages = createMessageMock(vi.mocked(sendMessage));
  let wrapper: ReturnType<typeof createTestWrapper>['wrapper'];

  beforeEach(() => {
    messages.reset().resolve('exportData', '').resolve('importData', undefined).resolve('resetAllData', undefined);
    wrapper = createTestWrapper().wrapper;
    vi.stubGlobal('confirm', vi.fn().mockReturnValue(true));
    vi.stubGlobal('alert', vi.fn());
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it('arms on the first click without opening the browser dialog', () => {
    render(<DataSection />, { wrapper });

    fireEvent.click(screen.getByRole('button', { name: 'Reset All Data' }));

    expect(screen.getByRole('button', { name: 'Click again to confirm' })).toBeInTheDocument();
    expect(window.confirm).not.toHaveBeenCalled();
    expect(sendMessage).not.toHaveBeenCalledWith('resetAllData');
  });

  it('expires confirmation after 3000ms', () => {
    vi.useFakeTimers();
    render(<DataSection />, { wrapper });

    fireEvent.click(screen.getByRole('button', { name: 'Reset All Data' }));
    act(() => {
      vi.advanceTimersByTime(3000);
    });

    expect(screen.getByRole('button', { name: 'Reset All Data' })).toBeInTheDocument();
    expect(sendMessage).not.toHaveBeenCalledWith('resetAllData');
  });

  it('disarms when the browser dialog is cancelled', async () => {
    vi.mocked(window.confirm).mockReturnValue(false);
    render(<DataSection />, { wrapper });

    fireEvent.click(screen.getByRole('button', { name: 'Reset All Data' }));
    fireEvent.click(screen.getByRole('button', { name: 'Click again to confirm' }));

    await waitFor(() => expect(screen.getByRole('button', { name: 'Reset All Data' })).toBeInTheDocument());
    expect(sendMessage).not.toHaveBeenCalledWith('resetAllData');
  });

  it('resets data, alerts success, and disarms after confirmation', async () => {
    render(<DataSection />, { wrapper });

    fireEvent.click(screen.getByRole('button', { name: 'Reset All Data' }));
    fireEvent.click(screen.getByRole('button', { name: 'Click again to confirm' }));

    await waitFor(() => expect(sendMessage).toHaveBeenCalledWith('resetAllData'));
    expect(window.alert).toHaveBeenCalledWith('All data has been reset');
    expect(screen.getByRole('button', { name: 'Reset All Data' })).toBeInTheDocument();
  });

  it('alerts the error and disarms when reset fails', async () => {
    const error = new Error('Reset failed');
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});
    messages.handle('resetAllData', () => Promise.reject(error));
    render(<DataSection />, { wrapper });

    fireEvent.click(screen.getByRole('button', { name: 'Reset All Data' }));
    fireEvent.click(screen.getByRole('button', { name: 'Click again to confirm' }));

    await waitFor(() => expect(consoleError).toHaveBeenCalledWith('Reset failed:', error));
    expect(window.alert).toHaveBeenCalledWith('Failed to reset data');
    expect(screen.getByRole('button', { name: 'Reset All Data' })).toBeInTheDocument();
  });
});
