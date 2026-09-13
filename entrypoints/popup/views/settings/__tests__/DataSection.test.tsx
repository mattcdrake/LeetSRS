/**
 * @vitest-environment happy-dom
 */
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { Suspense } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ApplicationError } from '@/domain/application-error';
import { I18nProvider } from '@/entrypoints/popup/contexts/I18nContext';
import { translations } from '@/i18n';
import { sendMessage } from '@/infrastructure/browser/messages';
import { replaceLearningDocument } from '@/infrastructure/storage/learning-document';
import { buildLearningDocument } from '@/test/utils/learning-document-mocks';
import { createMessageMock } from '@/test/utils/message-mocks';
import { createTestWrapper } from '@/test/utils/test-wrapper';
import { DataSection } from '../DataSection';

vi.mock('@/infrastructure/browser/messages', () => ({ sendMessage: vi.fn() }));

describe('DataSection reset', () => {
  const messages = createMessageMock(vi.mocked(sendMessage));
  let wrapper: ReturnType<typeof createTestWrapper>['wrapper'];

  beforeEach(() => {
    messages.reset().resolve('importData', undefined).resolve('resetAllData', undefined);
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

    await waitFor(() =>
      expect(consoleError).toHaveBeenCalledWith('Application operation failed', {
        operation: 'resetAllData',
        code: 'unexpected',
        status: undefined,
      })
    );
    expect(window.alert).toHaveBeenCalledWith('Failed to reset data');
    expect(screen.getByRole('button', { name: 'Reset All Data' })).toBeInTheDocument();
  });
  it.each(['de', 'en', 'hi', 'pl', 'zh-CN'] as const)(
    'shows translated import errors in %s without raw details',
    async (language) => {
      await replaceLearningDocument(buildLearningDocument({ settings: { language } }));
      vi.spyOn(console, 'error').mockImplementation(() => {});
      let failure: Error = new ApplicationError({ code: 'invalid_backup' });
      messages.handle('importData', () => Promise.reject(failure));
      const view = render(
        <Suspense fallback={null}>
          <I18nProvider>
            <DataSection />
          </I18nProvider>
        </Suspense>,
        { wrapper }
      );
      await screen.findByRole('button', { name: translations[language].settings.data.importData });
      const input = view.container.querySelector('input[type="file"]');
      if (!input) throw new Error('Missing import input');
      const file = new File(['{'], 'backup.json');
      fireEvent.change(input, { target: { files: [file] } });
      await waitFor(() =>
        expect(window.alert).toHaveBeenLastCalledWith(
          `${translations[language].settings.data.importFailed} ${translations[language].applicationErrors.invalid_backup}`
        )
      );
      failure = new Error('ghp_secret and raw remote body');
      fireEvent.change(input, { target: { files: [file] } });
      await waitFor(() =>
        expect(window.alert).toHaveBeenLastCalledWith(
          `${translations[language].settings.data.importFailed} ${translations[language].applicationErrors.unexpected}`
        )
      );
    }
  );
});
