/** @vitest-environment happy-dom */
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { expect, it, vi } from 'vitest';
import { updateSettings } from '@/background/learning';
import { background } from '@/shared/background-service';
import { replaceLearningDocument } from '@/shared/storage';
import { buildLearningDocument } from '@/test/utils/learning-document-mocks';
import { createServiceMock } from '@/test/utils/service-mocks';
import { createPopupTestWrapper } from '@/test/utils/test-wrapper';
import { ReviewSettingsSection } from '../ReviewSettingsSection';

vi.mock('@/shared/background-service', async (importOriginal) => {
  const { createMockBackground } = await import('@/test/utils/service-mocks');
  return {
    ...(await importOriginal<typeof import('@/shared/background-service')>()),
    background: createMockBackground(),
  };
});

it('keeps an unfinished limit while incoming settings refresh and saves the draft on blur', async () => {
  const document = buildLearningDocument({ settings: { maxNewCardsPerDay: 3 } });
  await replaceLearningDocument(document);
  const save = Promise.withResolvers<void>();
  createServiceMock(background).handle('updateSettings', async (changes) => {
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
  await waitFor(() => expect(background.updateSettings).toHaveBeenCalledWith({ maxNewCardsPerDay: 8 }));
  fireEvent.change(input, { target: { value: '9' } });
  await act(async () => save.resolve());
  await waitFor(() => expect(input).toHaveAttribute('placeholder', '8'));
  expect(input).toHaveValue(9);
  fireEvent.blur(input);
  await waitFor(() => expect(input).toHaveAttribute('placeholder', '9'));
  await act(() => replaceLearningDocument({ ...document, settings: { maxNewCardsPerDay: 7 } }));
  await waitFor(() => expect(input).toHaveValue(7));
});
