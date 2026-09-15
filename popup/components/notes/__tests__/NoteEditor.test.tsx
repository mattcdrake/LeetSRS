/** @vitest-environment happy-dom */
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { State } from 'ts-fsrs';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fakeBrowser } from 'wxt/testing/fake-browser';
import { storage } from '#imports';
import { sendMessage } from '@/shared/messages';
import { NOTES_MAX_LENGTH } from '@/shared/models';
import { STORAGE_KEYS } from '@/shared/storage';
import { createMockCardWithProblem } from '@/test/utils/card-mocks';
import { buildLearningDocument, setPopupLearningCardsQueryData } from '@/test/utils/learning-document-mocks';
import { createMessageMock } from '@/test/utils/message-mocks';
import { createPopupTestWrapper } from '@/test/utils/test-wrapper';
import { NoteEditor } from '../NoteEditor';

vi.mock('@/shared/messages', () => ({ sendMessage: vi.fn() }));

describe('NoteEditor', () => {
  const variant = 'regular';
  const frontendId = 'editor-card';
  const messages = createMessageMock(vi.mocked(sendMessage));

  beforeEach(() => {
    fakeBrowser.reset();
    vi.spyOn(storage, 'getItem').mockResolvedValue(buildLearningDocument());
    messages.reset().resolve('saveNote', undefined);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('enables saving only for a nonempty changed note within the limit', () => {
    const { wrapper, queryClient } = createPopupTestWrapper();
    vi.mocked(storage.getItem).mockResolvedValue(
      buildLearningDocument({
        cards: { [frontendId]: createMockCardWithProblem(State.New, { frontendId, note: 'Stored note' }) },
      })
    );
    setPopupLearningCardsQueryData(queryClient, [
      createMockCardWithProblem(State.New, { frontendId, note: 'Stored note' }),
    ]);
    render(<NoteEditor frontendId={frontendId} variant={variant} />, { wrapper });
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

  it('confirms deletion and shows pending feedback', async () => {
    const text = 'Stored note';
    const remove = Promise.withResolvers<void>();
    messages.handle('saveNote', async () => {
      await remove.promise;
      vi.mocked(storage.getItem).mockResolvedValue(buildLearningDocument());
      await storage.setItem(STORAGE_KEYS.learningDocument, buildLearningDocument());
    });
    const { wrapper, queryClient } = createPopupTestWrapper();
    vi.mocked(storage.getItem).mockResolvedValue(
      buildLearningDocument({
        cards: { [frontendId]: createMockCardWithProblem(State.New, { frontendId, note: text }) },
      })
    );
    setPopupLearningCardsQueryData(queryClient, [createMockCardWithProblem(State.New, { frontendId, note: text })]);
    render(<NoteEditor frontendId={frontendId} variant={variant} />, { wrapper });

    fireEvent.click(screen.getByRole('button', { name: 'Delete' }));
    const confirm = await screen.findByRole('button', { name: 'Confirm?' });
    expect(sendMessage).not.toHaveBeenCalledWith('saveNote', expect.anything());
    fireEvent.click(confirm);
    expect(await screen.findByRole('button', { name: 'Deleting...' })).toBeDisabled();
    expect(sendMessage).toHaveBeenCalledWith('saveNote', { frontendId, text: '' });
    expect(screen.getByRole('textbox', { name: 'Note text' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Save' })).toBeDisabled();

    await act(async () => remove.resolve());
    await waitFor(() => expect(screen.queryByRole('button', { name: 'Deleting...' })).not.toBeInTheDocument());
    await waitFor(() => expect(screen.getByRole('textbox', { name: 'Note text' })).toHaveValue(''));
    expect(screen.queryByRole('button', { name: 'Delete' })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Save' })).toBeDisabled();
  });

  it('shows a save failure, retains the draft, and clears the error after a successful retry', async () => {
    const error = new Error('Save failed');
    vi.spyOn(console, 'error').mockImplementation(() => {});
    messages.handle('saveNote', () => Promise.reject(error));
    const { wrapper, queryClient } = createPopupTestWrapper();
    vi.mocked(storage.getItem).mockResolvedValue(
      buildLearningDocument({
        cards: { [frontendId]: createMockCardWithProblem(State.New, { frontendId, note: 'Stored note' }) },
      })
    );
    setPopupLearningCardsQueryData(queryClient, [
      createMockCardWithProblem(State.New, { frontendId, note: 'Stored note' }),
    ]);
    render(<NoteEditor frontendId={frontendId} variant={variant} />, { wrapper });
    const textarea = screen.getByRole('textbox', { name: 'Note text' });

    fireEvent.change(textarea, { target: { value: 'Failed draft' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Could not save your note. Your draft is kept. Try saving again.'
    );
    expect(textarea).toHaveValue('Failed draft');
    expect(screen.getByRole('button', { name: 'Save' })).toBeEnabled();

    messages.handle('saveNote', async ({ text }) => {
      const saved = buildLearningDocument({
        cards: { [frontendId]: createMockCardWithProblem(State.New, { frontendId, note: text }) },
      });
      vi.mocked(storage.getItem).mockResolvedValue(saved);
      await storage.setItem(STORAGE_KEYS.learningDocument, saved);
    });
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));
    await waitFor(() => expect(screen.getByRole('button', { name: 'Save' })).toBeDisabled());
    expect(textarea).toHaveValue('Failed draft');
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('does not show another card’s save failure', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    messages.handle('saveNote', () => Promise.reject(new Error('Save failed')));
    const { wrapper } = createPopupTestWrapper();
    const view = render(<NoteEditor frontendId={frontendId} variant={variant} />, { wrapper });
    const textarea = screen.getByRole('textbox', { name: 'Note text' });
    await waitFor(() => expect(textarea).toBeEnabled());
    fireEvent.change(textarea, { target: { value: 'Unsaved draft' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));
    await screen.findByRole('alert');

    view.rerender(<NoteEditor frontendId="another-card" variant={variant} />);
    await waitFor(() => expect(screen.queryByRole('alert')).not.toBeInTheDocument());
    expect(textarea).toHaveValue('');
  });

  it.each(['save', 'delete'] as const)('isolates a pending %s when switching cards', async (operation) => {
    const pending = Promise.withResolvers<void>();
    messages.handle('saveNote', () => pending.promise);
    const { wrapper, queryClient } = createPopupTestWrapper();
    const cards = [
      createMockCardWithProblem(State.New, { frontendId, note: 'Stored note' }),
      createMockCardWithProblem(State.New, { frontendId: 'another-card', note: 'Other note' }),
    ];
    vi.mocked(storage.getItem).mockResolvedValue(
      buildLearningDocument({ cards: Object.fromEntries(cards.map((card) => [card.frontendId, card])) })
    );
    setPopupLearningCardsQueryData(queryClient, cards);
    const view = render(<NoteEditor frontendId={frontendId} variant={variant} />, { wrapper });
    const textarea = screen.getByRole('textbox', { name: 'Note text' });
    fireEvent.change(textarea, { target: { value: 'Outgoing draft' } });
    if (operation === 'save') {
      fireEvent.click(screen.getByRole('button', { name: 'Save' }));
      expect(await screen.findByRole('button', { name: 'Saving...' })).toBeDisabled();
      expect(screen.getByRole('button', { name: 'Delete' })).toBeDisabled();
    } else {
      fireEvent.click(screen.getByRole('button', { name: 'Delete' }));
      fireEvent.click(await screen.findByRole('button', { name: 'Confirm?' }));
      expect(await screen.findByRole('button', { name: 'Deleting...' })).toBeDisabled();
      expect(screen.getByRole('button', { name: 'Save' })).toBeDisabled();
    }
    expect(textarea).toBeDisabled();

    view.rerender(<NoteEditor frontendId="another-card" variant={variant} />);
    await waitFor(() => expect(textarea).toBeEnabled());
    fireEvent.change(textarea, { target: { value: 'Other draft' } });
    expect(screen.getByRole('button', { name: 'Save' })).toBeEnabled();
    expect(screen.getByRole('button', { name: 'Delete' })).toBeEnabled();
    await act(async () => pending.resolve());
    expect(textarea).toHaveValue('Other draft');
  });

  it('preserves a dirty draft during incoming updates and resets it and confirmation when switching cards', async () => {
    const { wrapper, queryClient } = createPopupTestWrapper();
    setPopupLearningCardsQueryData(queryClient, [
      createMockCardWithProblem(State.New, { frontendId, note: 'Stored note' }),
      createMockCardWithProblem(State.New, { frontendId: 'another-card', note: 'Other note' }),
    ]);
    vi.mocked(storage.getItem).mockResolvedValue(
      buildLearningDocument({
        cards: {
          [frontendId]: createMockCardWithProblem(State.New, { frontendId, note: 'Incoming note' }),
          'another-card': createMockCardWithProblem(State.New, { frontendId: 'another-card', note: 'Other note' }),
        },
      })
    );
    const view = render(<NoteEditor frontendId={frontendId} variant={variant} />, { wrapper });
    const textarea = screen.getByRole('textbox', { name: 'Note text' });
    fireEvent.change(textarea, { target: { value: 'Dirty draft' } });
    act(() =>
      setPopupLearningCardsQueryData(queryClient, [
        createMockCardWithProblem(State.New, { frontendId, note: 'Incoming note' }),
        createMockCardWithProblem(State.New, { frontendId: 'another-card', note: 'Other note' }),
      ])
    );
    expect(textarea).toHaveValue('Dirty draft');
    fireEvent.click(screen.getByRole('button', { name: 'Delete' }));
    await screen.findByRole('button', { name: 'Confirm?' });

    view.rerender(<NoteEditor frontendId="another-card" variant={variant} />);
    expect(textarea).toHaveValue('Other note');
    expect(screen.queryByRole('button', { name: 'Confirm?' })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Save' })).toBeDisabled();
    view.rerender(<NoteEditor frontendId={frontendId} variant={variant} />);
    expect(textarea).toHaveValue('Incoming note');
  });

  it('retains text and resets confirmation after a failed deletion', async () => {
    const error = new Error('Delete failed');
    const log = vi.spyOn(console, 'error').mockImplementation(() => {});
    messages.handle('saveNote', () => Promise.reject(error));
    const { wrapper, queryClient } = createPopupTestWrapper();
    vi.mocked(storage.getItem).mockResolvedValue(
      buildLearningDocument({
        cards: { [frontendId]: createMockCardWithProblem(State.New, { frontendId, note: 'Stored note' }) },
      })
    );
    setPopupLearningCardsQueryData(queryClient, [
      createMockCardWithProblem(State.New, { frontendId, note: 'Stored note' }),
    ]);
    render(<NoteEditor frontendId={frontendId} variant={variant} />, { wrapper });

    fireEvent.click(screen.getByRole('button', { name: 'Delete' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Confirm?' }));
    await waitFor(() => expect(log).toHaveBeenCalledWith('Failed to delete note:', error));
    expect(await screen.findByRole('button', { name: 'Delete' })).toBeEnabled();
    expect(screen.getByRole('textbox', { name: 'Note text' })).toHaveValue('Stored note');
  });
});
