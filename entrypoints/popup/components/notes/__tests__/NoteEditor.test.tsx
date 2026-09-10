/** @vitest-environment happy-dom */
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { NOTES_MAX_LENGTH, type Note } from '@/domain/notes';
import { noteQueryKeys } from '@/entrypoints/popup/queries/notes';
import { sendMessage } from '@/infrastructure/browser/messages';
import { createMessageMock } from '@/test/utils/message-mocks';
import { createTestWrapper } from '@/test/utils/test-wrapper';
import { NoteEditor } from '../NoteEditor';

vi.mock('@/infrastructure/browser/messages', () => ({ sendMessage: vi.fn() }));

describe.each(['regular', 'compact'] as const)('NoteEditor (%s)', (variant) => {
  const cardId = 'editor-card';
  const messages = createMessageMock(vi.mocked(sendMessage));

  beforeEach(() => {
    messages.reset().resolve('getNote', null).resolve('saveNote', undefined).resolve('deleteNote', undefined);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('enables saving only for a nonempty changed note within the limit', () => {
    const { wrapper, queryClient } = createTestWrapper();
    queryClient.setQueryData(noteQueryKeys.detail(cardId), { text: 'Stored note' });
    render(<NoteEditor cardId={cardId} variant={variant} />, { wrapper });
    const textarea = screen.getByRole('textbox', { name: 'Note text' });
    const save = screen.getByRole('button', { name: 'Save' });
    expect(save).toBeDisabled();

    fireEvent.change(textarea, { target: { value: 'Changed note' } });
    expect(save).toBeEnabled();
    fireEvent.change(textarea, { target: { value: '' } });
    expect(save).toBeDisabled();
    expect(screen.getByText('0/500')).toBeInTheDocument();
    fireEvent.change(textarea, { target: { value: 'a'.repeat(NOTES_MAX_LENGTH) } });
    expect(save).toBeEnabled();
    expect(screen.getByText('500/500')).toBeInTheDocument();
    fireEvent.change(textarea, { target: { value: 'Stored note' } });
    expect(save).toBeDisabled();
  });

  it('loads a note and saves edits with pending feedback', async () => {
    const save = Promise.withResolvers<void>();
    messages.resolve('getNote', { text: 'Stored note' }).resolve('saveNote', save.promise);
    const { wrapper } = createTestWrapper();
    render(<NoteEditor cardId={cardId} variant={variant} />, { wrapper });

    const textarea = screen.getByRole('textbox', { name: 'Note text' });
    expect(textarea).toBeDisabled();
    expect(textarea).toHaveAttribute('placeholder', 'Loading...');
    await waitFor(() => expect(textarea).toHaveValue('Stored note'));
    expect(screen.getByRole('button', { name: 'Save' })).toBeDisabled();

    fireEvent.change(textarea, { target: { value: 'Edited note' } });
    expect(screen.getByText('11/500')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));
    expect(await screen.findByRole('button', { name: 'Saving...' })).toBeDisabled();
    expect(textarea).toBeDisabled();
    expect(sendMessage).toHaveBeenCalledWith('saveNote', { cardId, text: 'Edited note' });

    await act(async () => save.resolve());
    await waitFor(() => expect(textarea).toBeEnabled());
  });

  it('shows the full over-limit count and prevents saving', () => {
    const { wrapper, queryClient } = createTestWrapper();
    queryClient.setQueryData(noteQueryKeys.detail(cardId), null);
    render(<NoteEditor cardId={cardId} variant={variant} />, { wrapper });

    expect(screen.queryByRole('button', { name: 'Delete' })).not.toBeInTheDocument();
    const textarea = screen.getByRole('textbox', { name: 'Note text' });
    const text = 'a'.repeat(NOTES_MAX_LENGTH + 1);
    fireEvent.change(textarea, { target: { value: text } });
    expect(textarea).toHaveValue(text);
    expect(textarea).not.toHaveAttribute('maxlength');
    expect(screen.getByText('501/500')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Save' })).toBeDisabled();
  });

  it.each(['', 'Stored note'])('confirms deletion of stored text "%s" and shows pending feedback', async (text) => {
    const remove = Promise.withResolvers<void>();
    messages.resolve('deleteNote', remove.promise);
    const { wrapper, queryClient } = createTestWrapper();
    queryClient.setQueryData(noteQueryKeys.detail(cardId), { text });
    render(<NoteEditor cardId={cardId} variant={variant} />, { wrapper });

    fireEvent.click(screen.getByRole('button', { name: 'Delete' }));
    const confirm = await screen.findByRole('button', { name: 'Confirm?' });
    expect(sendMessage).not.toHaveBeenCalledWith('deleteNote', expect.anything());
    fireEvent.click(confirm);
    expect(await screen.findByRole('button', { name: 'Deleting...' })).toBeDisabled();
    expect(sendMessage).toHaveBeenCalledWith('deleteNote', { cardId });

    await act(async () => remove.resolve());
    await waitFor(() => expect(screen.queryByRole('button', { name: 'Deleting...' })).not.toBeInTheDocument());
    expect(screen.getByRole('textbox', { name: 'Note text' })).toHaveValue('');
    expect(screen.queryByRole('button', { name: 'Delete' })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Save' })).toBeDisabled();
  });

  it('restores stored text after a failed save', async () => {
    const error = new Error('Save failed');
    const log = vi.spyOn(console, 'error').mockImplementation(() => {});
    messages.handle('saveNote', () => Promise.reject(error));
    const { wrapper, queryClient } = createTestWrapper();
    queryClient.setQueryData(noteQueryKeys.detail(cardId), { text: 'Stored note' });
    render(<NoteEditor cardId={cardId} variant={variant} />, { wrapper });
    const textarea = screen.getByRole('textbox', { name: 'Note text' });

    fireEvent.change(textarea, { target: { value: 'Failed draft' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));
    await waitFor(() => expect(log).toHaveBeenCalledWith('Failed to save note:', error));
    await waitFor(() => expect(textarea).toHaveValue('Stored note'));
    expect(screen.getByRole('button', { name: 'Save' })).toBeDisabled();
  });

  it('retains text and resets confirmation after a failed deletion', async () => {
    const error = new Error('Delete failed');
    const log = vi.spyOn(console, 'error').mockImplementation(() => {});
    messages.handle('deleteNote', () => Promise.reject(error));
    const { wrapper, queryClient } = createTestWrapper();
    queryClient.setQueryData(noteQueryKeys.detail(cardId), { text: 'Stored note' });
    render(<NoteEditor cardId={cardId} variant={variant} />, { wrapper });

    fireEvent.click(screen.getByRole('button', { name: 'Delete' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Confirm?' }));
    await waitFor(() => expect(log).toHaveBeenCalledWith('Failed to delete note:', error));
    expect(await screen.findByRole('button', { name: 'Delete' })).toBeEnabled();
    expect(screen.getByRole('textbox', { name: 'Note text' })).toHaveValue('Stored note');
  });
});

describe('NoteEditor autosizing', () => {
  const cardId = 'autosize-card';
  const messages = createMessageMock(vi.mocked(sendMessage));

  beforeEach(() => {
    messages.reset().resolve('getNote', null);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('sizes compact notes after fetching and grows, caps, and shrinks with edits', async () => {
    const note = Promise.withResolvers<Note | null>();
    messages.resolve('getNote', note.promise);
    let contentHeight = 24;
    vi.spyOn(HTMLElement.prototype, 'scrollHeight', 'get').mockImplementation(function (this: HTMLElement) {
      return this.style.height === 'auto'
        ? contentHeight
        : Math.max(contentHeight, Number.parseFloat(this.style.height));
    });
    const { wrapper } = createTestWrapper();
    render(<NoteEditor cardId={cardId} variant="compact" />, { wrapper });
    const textarea = screen.getByRole('textbox', { name: 'Note text' });
    expect(textarea).toHaveStyle({ height: '24px' });

    contentHeight = 48;
    await act(async () => note.resolve({ text: 'Fetched note' }));
    await waitFor(() => expect(textarea).toHaveValue('Fetched note'));
    expect(textarea).toHaveStyle({ height: '48px' });

    contentHeight = 96;
    fireEvent.change(textarea, { target: { value: 'A longer note' } });
    expect(textarea).toHaveStyle({ height: '96px' });

    contentHeight = 900;
    fireEvent.change(textarea, { target: { value: 'A very long note' } });
    expect(textarea).toHaveStyle({ height: '160px' });

    contentHeight = 24;
    fireEvent.change(textarea, { target: { value: '' } });
    expect(textarea).toHaveStyle({ height: '24px' });
  });

  it('keeps regular sizing fixed and clears compact height when switching variants', () => {
    const measure = vi.spyOn(HTMLElement.prototype, 'scrollHeight', 'get').mockReturnValue(96);
    const { wrapper, queryClient } = createTestWrapper();
    queryClient.setQueryData(noteQueryKeys.detail(cardId), { text: 'Stored note' });
    const { rerender } = render(<NoteEditor cardId={cardId} variant="regular" />, { wrapper });
    const textarea = screen.getByRole('textbox', { name: 'Note text' });

    fireEvent.change(textarea, { target: { value: 'Edited note' } });
    expect(textarea.style.height).toBe('');
    expect(measure).not.toHaveBeenCalled();

    rerender(<NoteEditor cardId={cardId} variant="compact" />);
    expect(textarea).toHaveStyle({ height: '96px' });

    rerender(<NoteEditor cardId={cardId} variant="regular" />);
    expect(textarea.style.height).toBe('');
    expect(textarea).toHaveValue('Edited note');
  });
});
