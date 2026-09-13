/** @vitest-environment happy-dom */
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { expect, it, vi } from 'vitest';
import { settingsQueryKeys } from '@/entrypoints/popup/queries/settings';
import { sendMessage } from '@/infrastructure/browser/messages';
import { replaceLearningDocument } from '@/infrastructure/storage/learning-document';
import { updateSettings } from '@/services/learning';
import { createMessageMock } from '@/test/utils/message-mocks';
import { buildSettings } from '@/test/utils/settings-mocks';
import { createTestWrapper } from '@/test/utils/test-wrapper';
import { ReviewSettingsSection } from '../ReviewSettingsSection';

vi.mock('@/infrastructure/browser/messages', () => ({ sendMessage: vi.fn() }));

it('offers only the daily new-card limit and saves changes', async () => {
  createMessageMock(vi.mocked(sendMessage)).resolve('updateSettings', undefined);
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

it('keeps an unfinished limit while incoming settings refresh and saves the draft on blur', async () => {
  const document = { schemaVersion: 6 as const, cards: {}, stats: {}, settings: { maxNewCardsPerDay: 3 } };
  await replaceLearningDocument(document);
  createMessageMock(vi.mocked(sendMessage)).handle('updateSettings', ({ changes }) => updateSettings(changes));
  render(<ReviewSettingsSection />, { wrapper: createTestWrapper().wrapper });
  const input = await screen.findByRole('spinbutton');
  await waitFor(() => expect(input).toHaveValue(3));
  fireEvent.change(input, { target: { value: '8' } });
  await act(() => replaceLearningDocument({ ...document, settings: { maxNewCardsPerDay: 12, theme: 'dark' } }));
  await waitFor(() => expect(input).toHaveAttribute('placeholder', '12'));
  expect(input).toHaveValue(8);
  fireEvent.blur(input);
  await waitFor(() =>
    expect(sendMessage).toHaveBeenCalledWith('updateSettings', { changes: { maxNewCardsPerDay: 8 } })
  );
  await waitFor(() => expect(input).toHaveAttribute('placeholder', '8'));
  await act(() => replaceLearningDocument({ ...document, settings: { maxNewCardsPerDay: 7 } }));
  await waitFor(() => expect(input).toHaveValue(7));
});
