import { State } from 'ts-fsrs';
import { storage } from '#imports';
import { STORAGE_KEYS } from '@/shared/storage';
import { createMockCardWithQuestion } from '@/test/utils/card-mocks';
import { buildLearningDocument, setPopupLearningCardsQueryData } from '@/test/utils/learning-document-mocks';
/**
 * @vitest-environment happy-dom
 */

import type { QueryClient } from '@tanstack/react-query';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { learningDocumentQueryKey, type PopupLearningDocumentSnapshot } from '@/popup/queries/learning-document';
import { sendMessage } from '@/shared/messages';
import { createMessageMock } from '@/test/utils/message-mocks';
import { createPopupTestWrapper } from '@/test/utils/test-wrapper';
import { NotesSection } from '../NotesSection';

vi.mock('@/shared/messages', () => ({ sendMessage: vi.fn() }));

describe('NotesSection', () => {
  const mockSlug = 'test-card-123';
  const messages = createMessageMock(vi.mocked(sendMessage));
  let wrapper: ReturnType<typeof createPopupTestWrapper>['wrapper'];
  let queryClient: QueryClient;

  const seedNote = (note: string | null) => {
    void storage.setItem(
      STORAGE_KEYS.learningDocument,
      buildLearningDocument({
        cards: { [mockSlug]: createMockCardWithQuestion(State.New, { frontendId: mockSlug, note: note ?? undefined }) },
      })
    );
    setPopupLearningCardsQueryData(queryClient, [
      createMockCardWithQuestion(State.New, { frontendId: mockSlug, note: note ?? undefined }),
    ]);
  };

  beforeEach(() => {
    messages.reset().resolve('saveNote', undefined);
    ({ wrapper, queryClient } = createPopupTestWrapper());
    seedNote(null);
  });

  it('disables an expanded note editor while its review action is pending', async () => {
    seedNote('Stored note');
    const view = render(<NotesSection frontendId={mockSlug} />, { wrapper });
    fireEvent.click(screen.getByRole('button', { expanded: false }));
    const textarea = await screen.findByRole('textbox', { name: 'Note text' });
    fireEvent.change(textarea, { target: { value: 'Unsaved draft' } });
    expect(screen.getByRole('button', { name: 'Save' })).toBeEnabled();

    view.rerender(<NotesSection frontendId={mockSlug} isDisabled />);

    expect(screen.getByRole('button', { expanded: true })).toBeDisabled();
    expect(textarea).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Delete' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Save' })).toBeDisabled();
  });

  it('retains the draft and delete confirmation across collapse and reopen', async () => {
    seedNote('Stored note');
    render(<NotesSection frontendId={mockSlug} />, { wrapper });
    const toggle = screen.getByRole('button', { expanded: false });
    fireEvent.click(toggle);
    const textarea = screen.getByRole('textbox', { name: 'Note text' });
    fireEvent.change(textarea, { target: { value: 'Unsaved draft' } });
    fireEvent.click(screen.getByRole('button', { name: 'Delete' }));
    await screen.findByRole('button', { name: 'Confirm?' });

    fireEvent.click(toggle);
    expect(textarea).not.toBeVisible();
    expect(screen.queryByRole('textbox')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Confirm?' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Save' })).not.toBeInTheDocument();

    fireEvent.click(toggle);
    expect(screen.getByRole('textbox', { name: 'Note text' })).toHaveValue('Unsaved draft');
    expect(screen.getByRole('button', { name: 'Confirm?' })).toBeEnabled();
    expect(screen.getByRole('button', { name: 'Save' })).toBeEnabled();
    expect(sendMessage).not.toHaveBeenCalledWith('saveNote', expect.anything());
  });

  it('finishes a pending save while collapsed and shows the saved note on reopening', async () => {
    const save = Promise.withResolvers<void>();
    messages.handle('saveNote', async ({ text }) => {
      await save.promise;
      seedNote(text);
    });
    render(<NotesSection frontendId={mockSlug} />, { wrapper });
    const toggle = screen.getByRole('button', { expanded: false });
    fireEvent.click(toggle);
    fireEvent.change(screen.getByRole('textbox'), { target: { value: 'Saved draft' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));
    expect(await screen.findByRole('button', { name: 'Saving...' })).toBeDisabled();

    fireEvent.click(toggle);
    await act(async () => save.resolve());
    await waitFor(() =>
      expect(
        queryClient.getQueryData<PopupLearningDocumentSnapshot>(learningDocumentQueryKey)?.document.cards[mockSlug]
      ).toMatchObject({ frontendId: mockSlug, note: 'Saved draft' })
    );
    expect(screen.queryByRole('textbox')).not.toBeInTheDocument();

    fireEvent.click(toggle);
    expect(screen.getByRole('textbox')).toHaveValue('Saved draft');
    expect(screen.getByRole('textbox')).toBeEnabled();
    expect(screen.getByRole('button', { name: 'Save' })).toBeDisabled();
    expect(sendMessage).toHaveBeenCalledWith('saveNote', { frontendId: mockSlug, text: 'Saved draft' });
  });
});
