import { State } from 'ts-fsrs';
import { storage } from '#imports';
import { STORAGE_KEYS } from '@/shared/storage';
import { createMockCardWithProblem } from '@/test/utils/card-mocks';
import { buildLearningDocument, setPopupLearningCardsQueryData } from '@/test/utils/learning-document-mocks';
/**
 * @vitest-environment happy-dom
 */

import type { QueryClient } from '@tanstack/react-query';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { learningDocumentQueryKey, type PopupLearningDocumentSnapshot } from '@/popup/queries/learning-document';
import { background } from '@/shared/background-service';
import { createServiceMock } from '@/test/utils/service-mocks';
import { createPopupTestWrapper } from '@/test/utils/test-wrapper';
import { NotesSection } from '../NotesSection';

vi.mock('@/shared/background-service');

describe('NotesSection', () => {
  const mockSlug = 'test-card-123';
  const service = createServiceMock(background);
  let wrapper: ReturnType<typeof createPopupTestWrapper>['wrapper'];
  let queryClient: QueryClient;

  const seedNote = (note: string | null) => {
    void storage.setItem(
      STORAGE_KEYS.learningDocument,
      buildLearningDocument({
        cards: { [mockSlug]: createMockCardWithProblem(State.New, { frontendId: mockSlug, note: note ?? undefined }) },
      })
    );
    setPopupLearningCardsQueryData(queryClient, [
      createMockCardWithProblem(State.New, { frontendId: mockSlug, note: note ?? undefined }),
    ]);
  };

  beforeEach(() => {
    service.reset().resolve('saveNote', undefined);
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
    expect(background.saveNote).not.toHaveBeenCalled();
  });

  it('finishes a pending save while collapsed and shows the saved note on reopening', async () => {
    const save = Promise.withResolvers<void>();
    service.handle('saveNote', async (_frontendId, text) => {
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
    expect(background.saveNote).toHaveBeenCalledWith(mockSlug, 'Saved draft');
  });
});
