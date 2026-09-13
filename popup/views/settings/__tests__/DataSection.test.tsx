/**
 * @vitest-environment happy-dom
 */
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { sendMessage } from '@/integrations/browser/messages';
import { createMessageMock } from '@/test/utils/message-mocks';
import { createPopupTestWrapper } from '@/test/utils/test-wrapper';
import { DataSection } from '../DataSection';

vi.mock('@/integrations/browser/messages', () => ({ sendMessage: vi.fn() }));

describe('DataSection reset', () => {
  const messages = createMessageMock(vi.mocked(sendMessage));
  let wrapper: ReturnType<typeof createPopupTestWrapper>['wrapper'];

  beforeEach(() => {
    messages.reset().resolve('importData', undefined).resolve('resetAllData', undefined);
    wrapper = createPopupTestWrapper().wrapper;
    vi.stubGlobal('confirm', vi.fn().mockReturnValue(true));
    vi.stubGlobal('alert', vi.fn());
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it('opens the dialog on the first click and preserves data when cancelled', () => {
    vi.mocked(window.confirm).mockReturnValue(false);
    render(<DataSection />, { wrapper });

    fireEvent.click(screen.getByRole('button', { name: 'Reset All Data' }));

    expect(window.confirm).toHaveBeenCalledExactlyOnceWith(
      expect.stringContaining('Are you absolutely sure you want to delete all data?')
    );
    expect(screen.getByRole('button', { name: 'Reset All Data' })).toBeEnabled();
    expect(window.alert).not.toHaveBeenCalled();
    expect(sendMessage).not.toHaveBeenCalledWith('resetAllData');
  });

  it('disables reset until the confirmed operation succeeds, then alerts success', async () => {
    const reset = Promise.withResolvers<void>();
    messages.handle('resetAllData', () => reset.promise);
    render(<DataSection />, { wrapper });

    fireEvent.click(screen.getByRole('button', { name: 'Reset All Data' }));

    const button = await screen.findByRole('button', { name: 'Resetting...' });
    expect(button).toBeDisabled();
    expect(window.alert).not.toHaveBeenCalled();
    fireEvent.click(button);
    expect(window.confirm).toHaveBeenCalledTimes(1);
    expect(sendMessage).toHaveBeenCalledExactlyOnceWith('resetAllData');

    reset.resolve();

    await waitFor(() => expect(window.alert).toHaveBeenCalledWith('All data has been reset'));
    expect(screen.getByRole('button', { name: 'Reset All Data' })).toBeEnabled();
  });

  it('alerts the error and enables retry when reset fails', async () => {
    const error = new Error('Reset failed');
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});
    messages.handle('resetAllData', () => Promise.reject(error));
    render(<DataSection />, { wrapper });

    fireEvent.click(screen.getByRole('button', { name: 'Reset All Data' }));

    await waitFor(() => expect(consoleError).toHaveBeenCalledWith('Reset failed:', error));
    expect(window.alert).toHaveBeenCalledWith('Failed to reset data');
    expect(screen.getByRole('button', { name: 'Reset All Data' })).toBeEnabled();
  });
});
