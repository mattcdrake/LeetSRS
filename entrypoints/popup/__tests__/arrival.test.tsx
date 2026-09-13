/** @vitest-environment happy-dom */
import { act, fireEvent, render, screen } from '@testing-library/react';
import { State } from 'ts-fsrs';
import { expect, it, vi } from 'vitest';
import { fakeBrowser } from 'wxt/testing/fake-browser';
import { sendMessage } from '@/infrastructure/browser/messages';
import { replaceLearningDocument } from '@/infrastructure/storage/learning-document';
import { createMockCard } from '@/test/utils/card-mocks';
import { buildLearningDocument } from '@/test/utils/learning-document-mocks';
import { createMessageMock } from '@/test/utils/message-mocks';
import { createTestWrapper } from '@/test/utils/test-wrapper';
import App from '../App';

vi.hoisted(() => vi.stubGlobal('__APP_VERSION__', 'test'));
vi.mock('@/infrastructure/browser/messages', () => ({ sendMessage: vi.fn() }));

it('keeps card filtering, expansion, and saved notes available during arrival refresh', async () => {
  fakeBrowser.reset();
  const arrival = Promise.withResolvers<undefined>();
  createMessageMock(vi.mocked(sendMessage)).resolve('refreshGistOnArrival', arrival.promise);
  const card = createMockCard(State.New, { name: 'Two Sum', slug: 'two-sum', note: 'Remember the complement' });
  await replaceLearningDocument(buildLearningDocument({ cards: { 'two-sum': card } }));
  const { wrapper } = createTestWrapper();
  render(<App />, { wrapper });
  fireEvent.click(await screen.findByRole('radio', { name: 'Cards' }));
  const filter = await screen.findByRole('textbox', { name: 'Filter cards' });
  expect(filter).toBeEnabled();
  fireEvent.change(filter, { target: { value: 'Two Sum' } });
  fireEvent.click(await screen.findByRole('button', { name: /Two Sum/ }));
  expect(await screen.findByText('Remember the complement')).toBeVisible();
  expect(screen.getByRole('status')).toHaveTextContent('Syncing...');
  await act(async () => arrival.resolve(undefined));
});
