/** @vitest-environment happy-dom */
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { settingsQueryKeys } from '@/hooks/queries/settings';
import { sendMessage } from '@/shared/messages';
import type { Theme } from '@/shared/settings';
import { createMessageMock } from '@/test/utils/message-mocks';
import { buildSettings } from '@/test/utils/settings-mocks';
import { createTestWrapper } from '@/test/utils/test-wrapper';
import { AppearanceSection } from '../AppearanceSection';

vi.mock('@/shared/messages', () => ({ sendMessage: vi.fn() }));

describe('AppearanceSection', () => {
  const messages = createMessageMock(vi.mocked(sendMessage));

  beforeEach(() => {
    messages.reset().resolve('getSettings', buildSettings()).resolve('updateSettings', undefined);
  });

  it.each([
    ['System', 'system'],
    ['Light', 'light'],
    ['Dark', 'dark'],
  ] as const)('updates the theme to %s', async (label, theme: Theme) => {
    const { wrapper, queryClient } = createTestWrapper();
    queryClient.setQueryData(settingsQueryKeys.all, buildSettings({ theme: theme === 'system' ? 'dark' : 'system' }));
    render(<AppearanceSection />, { wrapper });

    fireEvent.click(screen.getByRole('button', { name: /Theme$/ }));
    fireEvent.click(screen.getByRole('option', { name: label }));

    await waitFor(() =>
      expect(sendMessage).toHaveBeenCalledWith('updateSettings', {
        changes: { theme },
      })
    );
  });

  it('keeps the animations and badge controls unchanged', () => {
    const { wrapper, queryClient } = createTestWrapper();
    queryClient.setQueryData(settingsQueryKeys.all, buildSettings());
    render(<AppearanceSection />, { wrapper });

    expect(screen.getByRole('switch', { name: 'Enable animations' })).toBeChecked();
    expect(screen.getByRole('switch', { name: 'Show due count on icon' })).toBeChecked();
  });
});
