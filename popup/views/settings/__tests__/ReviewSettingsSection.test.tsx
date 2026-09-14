/** @vitest-environment happy-dom */
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { expect, it, vi } from 'vitest';
import { updateSettings } from '@/background/learning';
import { replaceLearningDocument } from '@/data/learning-document';
import { sendMessage } from '@/integrations/browser/messages';
import { buildLearningDocument, setPopupLearningDocumentQueryData } from '@/test/utils/learning-document-mocks';
import { createMessageMock } from '@/test/utils/message-mocks';
import { buildSettings } from '@/test/utils/settings-mocks';
import { createPopupTestWrapper } from '@/test/utils/test-wrapper';
import { ReviewSettingsSection } from '../ReviewSettingsSection';

vi.mock('@/integrations/browser/messages', () => ({ sendMessage: vi.fn() }));

it('offers only the daily new-card limit and saves changes', async () => {
  createMessageMock(vi.mocked(sendMessage)).resolve('updateSettings', undefined);
  const { wrapper, queryClient } = createPopupTestWrapper();
  setPopupLearningDocumentQueryData(queryClient, { settings: buildSettings() });
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
  const document = buildLearningDocument({ settings: { maxNewCardsPerDay: 3 } });
  await replaceLearningDocument(document);
  const save = Promise.withResolvers<void>();
  createMessageMock(vi.mocked(sendMessage)).handle('updateSettings', async ({ changes }) => {
    await save.promise;
    return updateSettings(changes);
  });
  render(<ReviewSettingsSection />, { wrapper: createPopupTestWrapper().wrapper });
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
  fireEvent.change(input, { target: { value: '9' } });
  await act(async () => save.resolve());
  await waitFor(() => expect(input).toHaveAttribute('placeholder', '8'));
  expect(input).toHaveValue(9);
  fireEvent.blur(input);
  await waitFor(() => expect(input).toHaveAttribute('placeholder', '9'));
  await act(() => replaceLearningDocument({ ...document, settings: { maxNewCardsPerDay: 7 } }));
  await waitFor(() => expect(input).toHaveValue(7));
});
