/**
 * @vitest-environment happy-dom
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { NotesSection } from '../NotesSection';
import { createTestWrapper } from '@/test/utils/test-wrapper';
import { useNoteQuery, useSaveNoteMutation, useDeleteNoteMutation } from '@/hooks/useBackgroundQueries';
import type { Note } from '@/shared/notes';
import { createQueryMock, createMutationMock } from '@/test/utils/query-mocks';

// Mock the hooks
vi.mock('@/hooks/useBackgroundQueries', () => ({
  useNoteQuery: vi.fn(),
  useSaveNoteMutation: vi.fn(),
  useDeleteNoteMutation: vi.fn(),
  useAnimationsEnabledQuery: vi.fn(() => ({ data: false })),
  useSetAnimationsEnabledMutation: vi.fn(() => ({ mutate: vi.fn() })),
  useThemeQuery: vi.fn(() => ({ data: 'dark' })),
  useSetThemeMutation: vi.fn(() => ({ mutate: vi.fn() })),
}));

describe('NotesSection', () => {
  const mockCardId = 'test-card-123';
  const { wrapper } = createTestWrapper();
  const mockMutateAsync = vi.fn();
  const mockDeleteMutateAsync = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();

    // Default mock - no existing note, not loading
    vi.mocked(useNoteQuery).mockReturnValue(createQueryMock(null) as ReturnType<typeof useNoteQuery>);

    // Default mock for save mutation
    vi.mocked(useSaveNoteMutation).mockReturnValue(
      createMutationMock({
        mutateAsync: mockMutateAsync,
        isPending: false,
      }) as ReturnType<typeof useSaveNoteMutation>
    );

    // Default mock for delete mutation
    vi.mocked(useDeleteNoteMutation).mockReturnValue(
      createMutationMock({
        mutateAsync: mockDeleteMutateAsync,
        isPending: false,
      }) as ReturnType<typeof useDeleteNoteMutation>
    );
  });

  it('should render collapsed by default', () => {
    render(<NotesSection cardId={mockCardId} />, { wrapper });

    expect(screen.getByText('Notes')).toBeInTheDocument();
    expect(screen.getByRole('button', { expanded: false })).toBeInTheDocument();
    expect(screen.queryByPlaceholderText(/add your notes/i)).not.toBeInTheDocument();
  });

  it('should expand when clicked', async () => {
    render(<NotesSection cardId={mockCardId} />, { wrapper });

    const expandButton = screen.getByRole('button', { expanded: false });
    fireEvent.click(expandButton);

    await waitFor(() => {
      expect(screen.getByRole('button', { expanded: true })).toBeInTheDocument();
      expect(screen.getByPlaceholderText('Add your notes here...')).toBeInTheDocument();
    });
  });

  it('should display character count', async () => {
    render(<NotesSection cardId={mockCardId} />, { wrapper });

    const expandButton = screen.getByRole('button', { expanded: false });
    fireEvent.click(expandButton);

    await waitFor(() => {
      expect(screen.getByText('0/500')).toBeInTheDocument();
    });

    const textarea = screen.getByPlaceholderText('Add your notes here...') as HTMLTextAreaElement;
    fireEvent.change(textarea, { target: { value: 'Test note' } });

    expect(screen.getByText('9/500')).toBeInTheDocument();
  });

  it('should show error state when over character limit', async () => {
    render(<NotesSection cardId={mockCardId} />, { wrapper });

    const expandButton = screen.getByRole('button', { expanded: false });
    fireEvent.click(expandButton);

    await waitFor(() => {
      expect(screen.getByPlaceholderText('Add your notes here...')).toBeInTheDocument();
    });

    const textarea = screen.getByPlaceholderText('Add your notes here...') as HTMLTextAreaElement;
    const longText = 'a'.repeat(501);
    fireEvent.change(textarea, { target: { value: longText } });

    const charCount = screen.getByText('501/500');
    expect(charCount).toBeInTheDocument();
    expect(charCount).toHaveClass('text-danger');
  });

  it('should disable save button when no changes', async () => {
    const mockNote: Note = {
      text: 'Existing note',
    };

    vi.mocked(useNoteQuery).mockReturnValue(createQueryMock(mockNote) as ReturnType<typeof useNoteQuery>);

    render(<NotesSection cardId={mockCardId} />, { wrapper });

    const expandButton = screen.getByRole('button', { expanded: false });
    fireEvent.click(expandButton);

    await waitFor(() => {
      const saveButton = screen.getByRole('button', { name: 'Save' });
      expect(saveButton).toBeDisabled();
    });
  });

  it('should enable save button when text changes', async () => {
    const mockNote: Note = {
      text: 'Existing note',
    };

    vi.mocked(useNoteQuery).mockReturnValue(createQueryMock(mockNote) as ReturnType<typeof useNoteQuery>);

    render(<NotesSection cardId={mockCardId} />, { wrapper });

    const expandButton = screen.getByRole('button', { expanded: false });
    fireEvent.click(expandButton);

    await waitFor(() => {
      expect(screen.getByPlaceholderText('Add your notes here...')).toBeInTheDocument();
    });

    const textarea = screen.getByPlaceholderText('Add your notes here...') as HTMLTextAreaElement;
    fireEvent.change(textarea, { target: { value: 'Updated note' } });

    const saveButton = screen.getByRole('button', { name: 'Save' });
    expect(saveButton).not.toBeDisabled();
  });

  it('should save note when save button clicked', async () => {
    mockMutateAsync.mockResolvedValue(undefined);

    render(<NotesSection cardId={mockCardId} />, { wrapper });

    const expandButton = screen.getByRole('button', { expanded: false });
    fireEvent.click(expandButton);

    await waitFor(() => {
      expect(screen.getByPlaceholderText('Add your notes here...')).toBeInTheDocument();
    });

    const textarea = screen.getByPlaceholderText('Add your notes here...') as HTMLTextAreaElement;
    fireEvent.change(textarea, { target: { value: 'New note text' } });

    const saveButton = screen.getByRole('button', { name: 'Save' });
    fireEvent.click(saveButton);

    await waitFor(() => {
      expect(mockMutateAsync).toHaveBeenCalledWith('New note text');
    });
  });

  it('should disable save button when text is over limit', async () => {
    render(<NotesSection cardId={mockCardId} />, { wrapper });

    const expandButton = screen.getByRole('button', { expanded: false });
    fireEvent.click(expandButton);

    await waitFor(() => {
      expect(screen.getByPlaceholderText('Add your notes here...')).toBeInTheDocument();
    });

    const textarea = screen.getByPlaceholderText('Add your notes here...') as HTMLTextAreaElement;
    const longText = 'a'.repeat(501);
    fireEvent.change(textarea, { target: { value: longText } });

    const saveButton = screen.getByRole('button', { name: 'Save' });
    expect(saveButton).toBeDisabled();
  });

  it('should load existing note', async () => {
    const existingNote: Note = {
      text: 'This is an existing note',
    };

    vi.mocked(useNoteQuery).mockReturnValue(createQueryMock(existingNote) as ReturnType<typeof useNoteQuery>);

    const { rerender } = render(<NotesSection cardId={mockCardId} />, { wrapper });

    // Force a re-render to trigger useEffect
    rerender(<NotesSection cardId={mockCardId} />);

    const expandButton = screen.getByRole('button', { expanded: false });
    fireEvent.click(expandButton);

    await waitFor(() => {
      const textarea = screen.getByPlaceholderText('Add your notes here...') as HTMLTextAreaElement;
      expect(textarea.value).toBe('This is an existing note');
    });
  });

  it('should call mutateAsync when save button is clicked', async () => {
    mockMutateAsync.mockResolvedValue(undefined);

    render(<NotesSection cardId={mockCardId} />, { wrapper });

    const expandButton = screen.getByRole('button', { expanded: false });
    fireEvent.click(expandButton);

    await waitFor(() => {
      expect(screen.getByPlaceholderText('Add your notes here...')).toBeInTheDocument();
    });

    const textarea = screen.getByPlaceholderText('Add your notes here...') as HTMLTextAreaElement;
    fireEvent.change(textarea, { target: { value: 'New note to save' } });

    const saveButton = screen.getByRole('button', { name: 'Save' });
    fireEvent.click(saveButton);

    await waitFor(() => {
      expect(mockMutateAsync).toHaveBeenCalledWith('New note to save');
    });
  });

  it('should handle save error gracefully', async () => {
    const originalNote: Note = {
      text: 'Original note content',
    };

    // Setup mock to return original note
    vi.mocked(useNoteQuery).mockReturnValue(createQueryMock(originalNote) as ReturnType<typeof useNoteQuery>);

    // Setup save mutation to reject
    mockMutateAsync.mockRejectedValue(new Error('Save failed'));

    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    const { rerender } = render(<NotesSection cardId={mockCardId} />, { wrapper });

    // Force a re-render to trigger useEffect
    rerender(<NotesSection cardId={mockCardId} />);

    const expandButton = screen.getByRole('button', { expanded: false });
    fireEvent.click(expandButton);

    // Wait for the original note to be loaded in the textarea
    await waitFor(() => {
      const textarea = screen.getByPlaceholderText('Add your notes here...') as HTMLTextAreaElement;
      expect(textarea.value).toBe('Original note content');
    });

    const textarea = screen.getByPlaceholderText('Add your notes here...') as HTMLTextAreaElement;

    // Change the text to something new
    fireEvent.change(textarea, { target: { value: 'New note that will fail to save' } });
    expect(textarea.value).toBe('New note that will fail to save');

    const saveButton = screen.getByRole('button', { name: 'Save' });
    fireEvent.click(saveButton);

    await waitFor(() => {
      expect(consoleSpy).toHaveBeenCalledWith('Failed to save note:', expect.any(Error));
    });

    // Text should revert to the original note content after save error
    await waitFor(() => {
      const textarea = screen.getByPlaceholderText('Add your notes here...') as HTMLTextAreaElement;
      expect(textarea.value).toBe('Original note content');
    });

    consoleSpy.mockRestore();
  });

  it('should handle empty note correctly', async () => {
    render(<NotesSection cardId={mockCardId} />, { wrapper });

    const expandButton = screen.getByRole('button', { expanded: false });
    fireEvent.click(expandButton);

    await waitFor(() => {
      expect(screen.getByPlaceholderText('Add your notes here...')).toBeInTheDocument();
    });

    const textarea = screen.getByPlaceholderText('Add your notes here...') as HTMLTextAreaElement;

    // Type some text first
    fireEvent.change(textarea, { target: { value: 'Some text' } });

    // Then clear it
    fireEvent.change(textarea, { target: { value: '' } });

    const saveButton = screen.getByRole('button', { name: 'Save' });
    expect(saveButton).toBeDisabled(); // Should be disabled for empty text
  });

  it('should not show delete button when no existing note', async () => {
    render(<NotesSection cardId={mockCardId} />, { wrapper });

    const expandButton = screen.getByRole('button', { expanded: false });
    fireEvent.click(expandButton);

    await waitFor(() => {
      expect(screen.getByPlaceholderText('Add your notes here...')).toBeInTheDocument();
    });

    expect(screen.queryByRole('button', { name: 'Delete' })).not.toBeInTheDocument();
  });

  it('should show delete button when there is an existing note', async () => {
    const existingNote: Note = {
      text: 'This is an existing note',
    };

    vi.mocked(useNoteQuery).mockReturnValue(createQueryMock(existingNote) as ReturnType<typeof useNoteQuery>);

    const { rerender } = render(<NotesSection cardId={mockCardId} />, { wrapper });
    rerender(<NotesSection cardId={mockCardId} />);

    const expandButton = screen.getByRole('button', { expanded: false });
    fireEvent.click(expandButton);

    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Delete' })).toBeInTheDocument();
    });
  });

  it('should require confirmation before delete', async () => {
    const existingNote: Note = {
      text: 'Note to be deleted',
    };

    vi.mocked(useNoteQuery).mockReturnValue(createQueryMock(existingNote) as ReturnType<typeof useNoteQuery>);
    mockDeleteMutateAsync.mockResolvedValue(undefined);

    const { rerender } = render(<NotesSection cardId={mockCardId} />, { wrapper });
    rerender(<NotesSection cardId={mockCardId} />);

    const expandButton = screen.getByRole('button', { expanded: false });
    fireEvent.click(expandButton);

    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Delete' })).toBeInTheDocument();
    });

    const deleteButton = screen.getByRole('button', { name: 'Delete' });

    // First click should show confirmation
    fireEvent.click(deleteButton);
    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Confirm?' })).toBeInTheDocument();
    });
    expect(mockDeleteMutateAsync).not.toHaveBeenCalled();

    // Second click should actually delete
    const confirmButton = screen.getByRole('button', { name: 'Confirm?' });
    fireEvent.click(confirmButton);

    await waitFor(() => {
      expect(mockDeleteMutateAsync).toHaveBeenCalled();
    });
  });

  it('should clear text area after successful delete', async () => {
    const existingNote: Note = {
      text: 'Note to be deleted',
    };

    vi.mocked(useNoteQuery).mockReturnValue(createQueryMock(existingNote) as ReturnType<typeof useNoteQuery>);
    mockDeleteMutateAsync.mockResolvedValue(undefined);

    const { rerender } = render(<NotesSection cardId={mockCardId} />, { wrapper });
    rerender(<NotesSection cardId={mockCardId} />);

    const expandButton = screen.getByRole('button', { expanded: false });
    fireEvent.click(expandButton);

    await waitFor(() => {
      const textarea = screen.getByPlaceholderText('Add your notes here...') as HTMLTextAreaElement;
      expect(textarea.value).toBe('Note to be deleted');
    });

    const deleteButton = screen.getByRole('button', { name: 'Delete' });
    fireEvent.click(deleteButton);

    // Click confirm
    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Confirm?' })).toBeInTheDocument();
    });
    const confirmButton = screen.getByRole('button', { name: 'Confirm?' });
    fireEvent.click(confirmButton);

    await waitFor(() => {
      const textarea = screen.getByPlaceholderText('Add your notes here...') as HTMLTextAreaElement;
      expect(textarea.value).toBe('');
    });
  });

  it('should disable delete button while deletion is pending', async () => {
    const existingNote: Note = {
      text: 'Note being deleted',
    };

    vi.mocked(useNoteQuery).mockReturnValue(createQueryMock(existingNote) as ReturnType<typeof useNoteQuery>);

    // Mock delete mutation as pending
    vi.mocked(useDeleteNoteMutation).mockReturnValue(
      createMutationMock({
        mutateAsync: mockDeleteMutateAsync,
        isPending: true,
      }) as ReturnType<typeof useDeleteNoteMutation>
    );

    const { rerender } = render(<NotesSection cardId={mockCardId} />, { wrapper });
    rerender(<NotesSection cardId={mockCardId} />);

    const expandButton = screen.getByRole('button', { expanded: false });
    fireEvent.click(expandButton);

    await waitFor(() => {
      const deleteButton = screen.getByRole('button', { name: 'Deleting...' });
      expect(deleteButton).toBeDisabled();
    });
  });

  it('should handle delete error gracefully', async () => {
    const existingNote: Note = {
      text: 'Note that fails to delete',
    };

    vi.mocked(useNoteQuery).mockReturnValue(createQueryMock(existingNote) as ReturnType<typeof useNoteQuery>);
    mockDeleteMutateAsync.mockRejectedValue(new Error('Delete failed'));

    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    const { rerender } = render(<NotesSection cardId={mockCardId} />, { wrapper });
    rerender(<NotesSection cardId={mockCardId} />);

    const expandButton = screen.getByRole('button', { expanded: false });
    fireEvent.click(expandButton);

    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Delete' })).toBeInTheDocument();
    });

    const deleteButton = screen.getByRole('button', { name: 'Delete' });
    fireEvent.click(deleteButton);

    // Click confirm
    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Confirm?' })).toBeInTheDocument();
    });
    const confirmButton = screen.getByRole('button', { name: 'Confirm?' });
    fireEvent.click(confirmButton);

    await waitFor(() => {
      expect(consoleSpy).toHaveBeenCalledWith('Failed to delete note:', expect.any(Error));
    });

    // Text should remain unchanged after delete error
    const textarea = screen.getByPlaceholderText('Add your notes here...') as HTMLTextAreaElement;
    expect(textarea.value).toBe('Note that fails to delete');

    consoleSpy.mockRestore();
  });
});
