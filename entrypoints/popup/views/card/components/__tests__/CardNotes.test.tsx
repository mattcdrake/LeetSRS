/** @vitest-environment happy-dom */
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { sendMessage } from '@/infrastructure/browser/messages';
import { createMessageMock } from '@/test/utils/message-mocks';
import { createTestWrapper } from '@/test/utils/test-wrapper';
import { CardNotes } from '../CardNotes';

vi.mock('@/infrastructure/browser/messages', () => ({ sendMessage: vi.fn() }));

describe('CardNotes', () => {
  const cardId = 'card-notes-card';
  const messages = createMessageMock(vi.mocked(sendMessage));

  beforeEach(() => {
    messages
      .reset()
      .resolve('getNote', { text: 'Stored card note' })
      .resolve('saveNote', undefined)
      .resolve('deleteNote', undefined);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('loads and autosizes the supplied card note, then saves edits to that card', async () => {
    vi.spyOn(HTMLElement.prototype, 'scrollHeight', 'get').mockReturnValue(48);
    const { wrapper } = createTestWrapper();
    render(<CardNotes cardId={cardId} />, { wrapper });

    expect(screen.getByText('Notes')).toBeInTheDocument();
    const textarea = screen.getByRole('textbox', { name: 'Note text' });
    await waitFor(() => expect(textarea).toHaveValue('Stored card note'));
    expect(sendMessage).toHaveBeenCalledWith('getNote', { cardId });
    expect(textarea.style.height).toBe('48px');

    fireEvent.change(textarea, { target: { value: 'Edited card note' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));
    await waitFor(() => expect(sendMessage).toHaveBeenCalledWith('saveNote', { cardId, text: 'Edited card note' }));
  });

  it('deletes the supplied card note through the shared editor', async () => {
    const { wrapper } = createTestWrapper();
    render(<CardNotes cardId={cardId} />, { wrapper });

    fireEvent.click(await screen.findByRole('button', { name: 'Delete' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Confirm?' }));
    await waitFor(() => expect(sendMessage).toHaveBeenCalledWith('deleteNote', { cardId }));
  });
});
