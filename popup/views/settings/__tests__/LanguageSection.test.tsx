/** @vitest-environment happy-dom */
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { sendMessage } from '@/integrations/browser/messages';
import { setPopupLearningDocumentQueryData } from '@/test/utils/learning-document-mocks';
import { createMessageMock } from '@/test/utils/message-mocks';
import { buildSettings } from '@/test/utils/settings-mocks';
import { createPopupTestWrapper } from '@/test/utils/test-wrapper';
import { LanguageSection } from '../LanguageSection';

vi.mock('@/integrations/browser/messages', () => ({ sendMessage: vi.fn() }));

describe('LanguageSection', () => {
  const messages = createMessageMock(vi.mocked(sendMessage));

  beforeEach(() => {
    messages.reset().resolve('updateSettings', undefined);
  });

  it('shows the current language and persists a new selection', async () => {
    const { wrapper, queryClient } = createPopupTestWrapper();
    setPopupLearningDocumentQueryData(queryClient, { settings: buildSettings({ language: 'en' }) });
    render(<LanguageSection />, { wrapper });

    const languageSelect = screen.getByRole('button', { name: /Display language/ });
    expect(languageSelect).toHaveTextContent('English');

    fireEvent.click(languageSelect);
    fireEvent.click(screen.getByRole('option', { name: 'Deutsch' }));

    await waitFor(() =>
      expect(sendMessage).toHaveBeenCalledWith('updateSettings', {
        changes: { language: 'de' },
      })
    );
  });
});
