/** @vitest-environment happy-dom */
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { expect, it, vi } from 'vitest';
import { settingsQueryKeys } from '@/entrypoints/popup/queries/settings';
import { sendMessage } from '@/infrastructure/browser/messages';
import { createMessageMock } from '@/test/utils/message-mocks';
import { buildSettings } from '@/test/utils/settings-mocks';
import { createTestWrapper } from '@/test/utils/test-wrapper';
import { ReviewSettingsSection } from '../ReviewSettingsSection';

vi.mock('@/infrastructure/browser/messages', () => ({ sendMessage: vi.fn() }));

it('offers only the daily new-card limit and saves changes', async () => {
  createMessageMock(vi.mocked(sendMessage))
    .resolve('getSettings', buildSettings())
    .resolve('updateSettings', undefined);
  const { wrapper, queryClient } = createTestWrapper();
  queryClient.setQueryData(settingsQueryKeys.all, buildSettings());
  render(<ReviewSettingsSection />, { wrapper });

  const input = screen.getByRole('spinbutton', { name: 'New Cards Per Day' });
  expect(screen.getAllByRole('spinbutton')).toEqual([input]);
  expect(input).toHaveValue(3);
  fireEvent.change(input, { target: { value: '8' } });
  fireEvent.blur(input);

  await waitFor(() =>
    expect(sendMessage).toHaveBeenCalledWith('updateSettings', { changes: { maxNewCardsPerDay: 8 } })
  );
});
