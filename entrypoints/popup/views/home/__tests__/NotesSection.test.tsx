/**
 * @vitest-environment happy-dom
 */

import type { QueryClient } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { queryKeys } from '@/hooks/useBackgroundQueries';
import { sendMessage } from '@/shared/messages';
import type { Note } from '@/shared/notes';
import { createDeferred } from '@/test/utils/deferred';
import { createMessageMock } from '@/test/utils/message-mocks';
import { createTestWrapper } from '@/test/utils/test-wrapper';
import { NotesSection } from '../NotesSection';

// Mock the hooks
vi.mock('@/shared/messages', () => ({ sendMessage: vi.fn() }));

describe('NotesSection', () => {
  const mockCardId = 'test-card-123';
  const messages = createMessageMock(vi.mocked(sendMessage));
  let wrapper: ReturnType<typeof createTestWrapper>['wrapper'];
  let queryClient: QueryClient;

  const seedNote = (note: Note | null) => queryClient.setQueryData(queryKeys.notes.detail(mockCardId), note);

  beforeEach(() => {
    messages.reset().resolve('getNote', null).resolve('saveNote', undefined).resolve('deleteNote', undefined);
    ({ wrapper, queryClient } = createTestWrapper());
    seedNote(null);
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

    seedNote(mockNote);

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

    seedNote(mockNote);

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
      expect(sendMessage).toHaveBeenCalledWith('saveNote', { cardId: mockCardId, text: 'New note text' });
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

    seedNote(existingNote);

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
      expect(sendMessage).toHaveBeenCalledWith('saveNote', { cardId: mockCardId, text: 'New note to save' });
    });
  });

  it('should handle save error gracefully', async () => {
    const originalNote: Note = {
      text: 'Original note content',
    };

    // Setup mock to return original note
    seedNote(originalNote);

    // Setup save mutation to reject
    messages.handle('saveNote', () => Promise.reject(new Error('Save failed')));

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

    seedNote(existingNote);

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

    seedNote(existingNote);

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
    expect(sendMessage).not.toHaveBeenCalledWith('deleteNote', expect.anything());

    // Second click should actually delete
    const confirmButton = screen.getByRole('button', { name: 'Confirm?' });
    fireEvent.click(confirmButton);

    await waitFor(() => {
      expect(sendMessage).toHaveBeenCalledWith('deleteNote', { cardId: mockCardId });
    });
  });

  it('should clear text area after successful delete', async () => {
    const existingNote: Note = {
      text: 'Note to be deleted',
    };

    seedNote(existingNote);

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

    seedNote(existingNote);

    const deletion = createDeferred<void>();
    messages.resolve('deleteNote', deletion.promise);

    const { rerender } = render(<NotesSection cardId={mockCardId} />, { wrapper });
    rerender(<NotesSection cardId={mockCardId} />);

    const expandButton = screen.getByRole('button', { expanded: false });
    fireEvent.click(expandButton);

    fireEvent.click(await screen.findByRole('button', { name: 'Delete' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Confirm?' }));
    await waitFor(() => expect(screen.getByRole('button', { name: 'Deleting...' })).toBeDisabled());
    deletion.resolve();
    await deletion.promise;
  });

  it('should handle delete error gracefully', async () => {
    const existingNote: Note = {
      text: 'Note that fails to delete',
    };

    seedNote(existingNote);
    messages.handle('deleteNote', () => Promise.reject(new Error('Delete failed')));

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
