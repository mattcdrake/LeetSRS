/** @vitest-environment happy-dom */
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { expect, it, vi } from 'vitest';
import { ApplicationError } from '@/domain/application-error';
import { I18nProvider } from '@/entrypoints/popup/contexts/I18nContext';
import { settingsQueryKeys } from '@/entrypoints/popup/queries/settings';
import { translations } from '@/i18n';
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
  const save = Promise.withResolvers<void>();
  createMessageMock(vi.mocked(sendMessage)).handle('updateSettings', async ({ changes }) => {
    await save.promise;
    return updateSettings(changes);
  });
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
  fireEvent.change(input, { target: { value: '9' } });
  await act(async () => save.resolve());
  await waitFor(() => expect(input).toHaveAttribute('placeholder', '8'));
  expect(input).toHaveValue(9);
  fireEvent.blur(input);
  await waitFor(() => expect(input).toHaveAttribute('placeholder', '9'));
  await act(() => replaceLearningDocument({ ...document, settings: { maxNewCardsPerDay: 7 } }));
  await waitFor(() => expect(input).toHaveValue(7));
});

it('translates rejected settings while retaining the draft and clears feedback after retry', async () => {
  vi.spyOn(console, 'error').mockImplementation(() => {});
  const messages = createMessageMock(vi.mocked(sendMessage));
  messages.handle('updateSettings', () => Promise.reject(new ApplicationError({ code: 'invalid_settings' })));
  const { wrapper, queryClient } = createTestWrapper();
  await replaceLearningDocument({ schemaVersion: 6, cards: {}, stats: {}, settings: { language: 'de' } });
  queryClient.setQueryData(settingsQueryKeys.all, buildSettings({ language: 'de' }));
  render(
    <I18nProvider>
      <ReviewSettingsSection />
    </I18nProvider>,
    { wrapper }
  );
  const input = screen.getByRole('spinbutton');
  fireEvent.change(input, { target: { value: '8' } });
  fireEvent.blur(input);
  expect(await screen.findByRole('alert')).toHaveTextContent(translations.de.applicationErrors.invalid_settings);
  expect(input).toHaveValue(8);
  messages.resolve('updateSettings', undefined);
  fireEvent.blur(input);
  await waitFor(() => expect(screen.queryByRole('alert')).not.toBeInTheDocument());
});
