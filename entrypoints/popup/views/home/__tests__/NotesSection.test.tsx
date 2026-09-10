/**
 * @vitest-environment happy-dom
 */

import type { QueryClient } from '@tanstack/react-query';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Note } from '@/domain/notes';
import { noteQueryKeys } from '@/entrypoints/popup/queries/notes';
import { sendMessage } from '@/infrastructure/browser/messages';
import { createMessageMock } from '@/test/utils/message-mocks';
import { createTestWrapper } from '@/test/utils/test-wrapper';
import { NotesSection } from '../NotesSection';

vi.mock('@/infrastructure/browser/messages', () => ({ sendMessage: vi.fn() }));

describe('NotesSection', () => {
  const mockCardId = 'test-card-123';
  const messages = createMessageMock(vi.mocked(sendMessage));
  let wrapper: ReturnType<typeof createTestWrapper>['wrapper'];
  let queryClient: QueryClient;

  const seedNote = (note: Note | null) => queryClient.setQueryData(noteQueryKeys.detail(mockCardId), note);

  beforeEach(() => {
    messages.reset().resolve('getNote', null).resolve('saveNote', undefined).resolve('deleteNote', undefined);
    ({ wrapper, queryClient } = createTestWrapper());
    seedNote(null);
  });

  it('should render collapsed by default', () => {
    render(<NotesSection cardId={mockCardId} />, { wrapper });

    expect(screen.getByText('Notes')).toBeInTheDocument();
    expect(screen.getByRole('button', { expanded: false })).toBeInTheDocument();
    expect(screen.getByPlaceholderText(/add your notes/i)).not.toBeVisible();
    expect(screen.queryByRole('textbox')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Save' })).not.toBeInTheDocument();
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

  it('retains the draft and delete confirmation across collapse and reopen', async () => {
    seedNote({ text: 'Stored note' });
    render(<NotesSection cardId={mockCardId} />, { wrapper });
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
    expect(sendMessage).not.toHaveBeenCalledWith('deleteNote', expect.anything());
  });

  it('finishes a pending save while collapsed and shows the saved note on reopening', async () => {
    const save = Promise.withResolvers<void>();
    messages.resolve('saveNote', save.promise).resolve('getNote', { text: 'Saved draft' });
    render(<NotesSection cardId={mockCardId} />, { wrapper });
    const toggle = screen.getByRole('button', { expanded: false });
    fireEvent.click(toggle);
    fireEvent.change(screen.getByRole('textbox'), { target: { value: 'Saved draft' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));
    expect(await screen.findByRole('button', { name: 'Saving...' })).toBeDisabled();

    fireEvent.click(toggle);
    await act(async () => save.resolve());
    await waitFor(() =>
      expect(queryClient.getQueryData(noteQueryKeys.detail(mockCardId))).toEqual({ text: 'Saved draft' })
    );
    expect(screen.queryByRole('textbox')).not.toBeInTheDocument();

    fireEvent.click(toggle);
    expect(screen.getByRole('textbox')).toHaveValue('Saved draft');
    expect(screen.getByRole('textbox')).toBeEnabled();
    expect(screen.getByRole('button', { name: 'Save' })).toBeDisabled();
    expect(sendMessage).toHaveBeenCalledWith('saveNote', { cardId: mockCardId, text: 'Saved draft' });
  });

  it('loads the supplied card while collapsed and saves edits to that card', async () => {
    const cardId = 'another-home-card';
    messages.resolve('getNote', { text: 'This card note' });
    render(<NotesSection cardId={cardId} />, { wrapper });

    await waitFor(() => expect(sendMessage).toHaveBeenCalledWith('getNote', { cardId }));
    await waitFor(() => expect(screen.getByRole('textbox', { hidden: true })).toHaveValue('This card note'));
    fireEvent.click(screen.getByRole('button', { expanded: false }));
    fireEvent.change(screen.getByRole('textbox', { name: 'Note text' }), { target: { value: 'Edited card note' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));
    await waitFor(() => expect(sendMessage).toHaveBeenCalledWith('saveNote', { cardId, text: 'Edited card note' }));
  });
});
