/** @vitest-environment happy-dom */
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NOTES_MAX_LENGTH } from '@/domain/notes';
import { noteQueryKeys } from '@/entrypoints/popup/queries/notes';
import { sendMessage } from '@/infrastructure/browser/messages';
import { createDeferred } from '@/test/utils/deferred';
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

  it('loads a note and saves edits with pending feedback', async () => {
    const save = createDeferred<void>();
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
    expect(screen.getByText('501/500')).toHaveClass('text-danger');
    expect(screen.getByRole('button', { name: 'Save' })).toBeDisabled();
  });

  it('confirms deletion of a stored empty note and shows pending feedback', async () => {
    const remove = createDeferred<void>();
    messages.resolve('deleteNote', remove.promise);
    const { wrapper, queryClient } = createTestWrapper();
    queryClient.setQueryData(noteQueryKeys.detail(cardId), { text: '' });
    render(<NoteEditor cardId={cardId} variant={variant} />, { wrapper });

    fireEvent.click(screen.getByRole('button', { name: 'Delete' }));
    const confirm = await screen.findByRole('button', { name: 'Confirm?' });
    expect(confirm).toHaveClass('bg-ultra-danger');
    expect(sendMessage).not.toHaveBeenCalledWith('deleteNote', expect.anything());
    fireEvent.click(confirm);
    expect(await screen.findByRole('button', { name: 'Deleting...' })).toBeDisabled();
    expect(sendMessage).toHaveBeenCalledWith('deleteNote', { cardId });

    await act(async () => remove.resolve());
    await waitFor(() => expect(screen.queryByRole('button', { name: 'Deleting...' })).not.toBeInTheDocument());
  });
});
