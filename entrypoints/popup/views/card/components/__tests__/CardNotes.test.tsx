/**
 * @vitest-environment happy-dom
 */

import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useDeleteNoteMutation, useNoteQuery, useSaveNoteMutation } from '@/hooks/useBackgroundQueries';
import { NOTES_MAX_LENGTH, type Note } from '@/shared/notes';
import { createMutationMock, createQueryMock } from '@/test/utils/query-mocks';
import { createTestWrapper } from '@/test/utils/test-wrapper';
import { CardNotes } from '../CardNotes';

// Mock the hooks
vi.mock('@/hooks/useBackgroundQueries', () => ({
  useNoteQuery: vi.fn(),
  useSaveNoteMutation: vi.fn(),
  useDeleteNoteMutation: vi.fn(),
}));

/**
 * The note-editing state machine itself is covered by hooks/__tests__/useNoteEditor.test.tsx.
 * These cases pin what CardNotes renders on top of it.
 */
describe('CardNotes', () => {
  const mockCardId = 'test-card-123';
  const { wrapper } = createTestWrapper();
  const mockSaveMutateAsync = vi.fn();
  const mockDeleteMutateAsync = vi.fn();

  const mockNote = (note: Note | null) => {
    vi.mocked(useNoteQuery).mockReturnValue(createQueryMock(note) as ReturnType<typeof useNoteQuery>);
  };

  const getTextarea = () => screen.getByRole('textbox') as HTMLTextAreaElement;

  beforeEach(() => {
    vi.clearAllMocks();

    mockNote(null);
    vi.mocked(useSaveNoteMutation).mockReturnValue(
      createMutationMock({ mutateAsync: mockSaveMutateAsync }) as ReturnType<typeof useSaveNoteMutation>
    );
    vi.mocked(useDeleteNoteMutation).mockReturnValue(
      createMutationMock({ mutateAsync: mockDeleteMutateAsync }) as ReturnType<typeof useDeleteNoteMutation>
    );
  });

  it('should render the stored note', () => {
    mockNote({ text: 'Existing note' });

    render(<CardNotes cardId={mockCardId} />, { wrapper });

    expect(getTextarea()).toHaveValue('Existing note');
    expect(screen.getByText('13/500')).toBeInTheDocument();
  });

  it('should save the edited text', async () => {
    render(<CardNotes cardId={mockCardId} />, { wrapper });

    fireEvent.change(getTextarea(), { target: { value: 'A new note' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));

    await waitFor(() => {
      expect(mockSaveMutateAsync).toHaveBeenCalledWith('A new note');
    });
  });

  it('should disable save when the textarea is cleared', () => {
    mockNote({ text: 'Existing note' });

    render(<CardNotes cardId={mockCardId} />, { wrapper });

    fireEvent.change(getTextarea(), { target: { value: '' } });

    expect(screen.getByRole('button', { name: 'Save' })).toBeDisabled();
  });

  describe('over the character limit', () => {
    it('should not cap typing with a maxLength attribute', () => {
      render(<CardNotes cardId={mockCardId} />, { wrapper });

      expect(getTextarea()).not.toHaveAttribute('maxlength');
    });

    it('should show the true count in red and disable save', () => {
      render(<CardNotes cardId={mockCardId} />, { wrapper });

      const longText = 'a'.repeat(NOTES_MAX_LENGTH + 1);
      fireEvent.change(getTextarea(), { target: { value: longText } });

      expect(getTextarea()).toHaveValue(longText);

      const charCount = screen.getByText('501/500');
      expect(charCount).toBeInTheDocument();
      expect(charCount).toHaveClass('text-danger');

      expect(screen.getByRole('button', { name: 'Save' })).toBeDisabled();
    });
  });

  describe('delete', () => {
    it('should not render when there is no stored note', () => {
      render(<CardNotes cardId={mockCardId} />, { wrapper });

      expect(screen.queryByRole('button', { name: 'Delete' })).not.toBeInTheDocument();
    });

    it('should render for a stored note with empty text', () => {
      mockNote({ text: '' });

      render(<CardNotes cardId={mockCardId} />, { wrapper });

      expect(screen.getByRole('button', { name: 'Delete' })).toBeInTheDocument();
    });

    it('should require confirmation before deleting', async () => {
      mockNote({ text: 'Existing note' });

      render(<CardNotes cardId={mockCardId} />, { wrapper });

      fireEvent.click(screen.getByRole('button', { name: 'Delete' }));

      const confirmButton = await screen.findByRole('button', { name: 'Confirm?' });
      expect(mockDeleteMutateAsync).not.toHaveBeenCalled();

      fireEvent.click(confirmButton);

      await waitFor(() => {
        expect(mockDeleteMutateAsync).toHaveBeenCalledTimes(1);
      });
    });
  });

  describe('auto-growing textarea', () => {
    const stubScrollHeight = (height: number) => {
      const descriptor = Object.getOwnPropertyDescriptor(HTMLElement.prototype, 'scrollHeight');
      Object.defineProperty(HTMLElement.prototype, 'scrollHeight', {
        configurable: true,
        get: () => height,
      });
      return () => {
        if (descriptor) {
          Object.defineProperty(HTMLElement.prototype, 'scrollHeight', descriptor);
        }
      };
    };

    let restoreScrollHeight = () => {};

    afterEach(() => {
      restoreScrollHeight();
    });

    it('should grow to fit the content', () => {
      restoreScrollHeight = stubScrollHeight(48);
      mockNote({ text: 'A note spanning a few lines' });

      render(<CardNotes cardId={mockCardId} />, { wrapper });

      expect(getTextarea().style.height).toBe('48px');
    });

    it('should stop growing at the max height so long notes scroll', () => {
      restoreScrollHeight = stubScrollHeight(900);
      mockNote({ text: 'a'.repeat(NOTES_MAX_LENGTH) });

      render(<CardNotes cardId={mockCardId} />, { wrapper });

      const textarea = getTextarea();
      expect(textarea.style.height).toBe('160px');
      expect(textarea).toHaveClass('max-h-40', 'overflow-y-auto');
    });
  });
});
