/** @vitest-environment happy-dom */
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Theme } from '@/domain/settings';
import { sendMessage } from '@/integrations/browser/messages';
import { setPopupLearningDocumentQueryData } from '@/test/utils/learning-document-mocks';
import { createMessageMock } from '@/test/utils/message-mocks';
import { buildSettings } from '@/test/utils/settings-mocks';
import { createPopupTestWrapper } from '@/test/utils/test-wrapper';
import { AppearanceSection } from '../AppearanceSection';

vi.mock('@/integrations/browser/messages', () => ({ sendMessage: vi.fn() }));

describe('AppearanceSection', () => {
  const messages = createMessageMock(vi.mocked(sendMessage));

  beforeEach(() => {
    messages.reset().resolve('updateSettings', undefined);
  });

  it.each([
    ['System', 'system'],
    ['Light', 'light'],
    ['Dark', 'dark'],
  ] as const)('updates the theme to %s', async (label, theme: Theme) => {
    const { wrapper, queryClient } = createPopupTestWrapper();
    setPopupLearningDocumentQueryData(queryClient, {
      settings: buildSettings({ theme: theme === 'system' ? 'dark' : 'system' }),
    });
    render(<AppearanceSection />, { wrapper });

    fireEvent.click(screen.getByRole('button', { name: /Theme$/ }));
    fireEvent.click(screen.getByRole('option', { name: label }));

    await waitFor(() =>
      expect(sendMessage).toHaveBeenCalledWith('updateSettings', {
        changes: { theme },
      })
    );
  });

  it('shows the badge control', () => {
    const { wrapper, queryClient } = createPopupTestWrapper();
    setPopupLearningDocumentQueryData(queryClient, { settings: buildSettings() });
    render(<AppearanceSection />, { wrapper });

    expect(screen.getByRole('switch', { name: 'Show due count on icon' })).toBeChecked();
  });
});
