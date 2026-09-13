/** @vitest-environment happy-dom */
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { State } from 'ts-fsrs';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fakeBrowser } from 'wxt/testing/fake-browser';
import { storage } from '#imports';
import { NOTES_MAX_LENGTH } from '@/domain/cards';
import { noteQueryKeys } from '@/entrypoints/popup/queries/notes';
import { sendMessage } from '@/infrastructure/browser/messages';
import { STORAGE_KEYS } from '@/infrastructure/storage/storage-keys';
import { createMockCard } from '@/test/utils/card-mocks';
import { buildLearningDocument } from '@/test/utils/learning-document-mocks';
import { createMessageMock } from '@/test/utils/message-mocks';
import { createTestWrapper } from '@/test/utils/test-wrapper';
import { NoteEditor } from '../NoteEditor';

vi.mock('@/infrastructure/browser/messages', () => ({ sendMessage: vi.fn() }));

describe.each(['regular', 'compact'] as const)('NoteEditor (%s)', (variant) => {
  const slug = 'editor-card';
  const messages = createMessageMock(vi.mocked(sendMessage));

  beforeEach(() => {
    fakeBrowser.reset();
    vi.spyOn(storage, 'getItem').mockResolvedValue(buildLearningDocument());
    messages.reset().resolve('saveNote', undefined).resolve('deleteNote', undefined);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('enables saving only for a nonempty changed note within the limit', () => {
    const { wrapper, queryClient } = createTestWrapper();
    vi.mocked(storage.getItem).mockResolvedValue(
      buildLearningDocument({ cards: { [slug]: createMockCard(State.New, { slug, note: 'Stored note' }) } })
    );
    queryClient.setQueryData(noteQueryKeys.detail(slug), 'Stored note');
    render(<NoteEditor slug={slug} variant={variant} />, { wrapper });
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
    vi.mocked(storage.getItem).mockResolvedValue(
      buildLearningDocument({ cards: { [slug]: createMockCard(State.New, { slug, note: 'Stored note' }) } })
    );
    messages.resolve('saveNote', save.promise);
    const { wrapper } = createTestWrapper();
    render(<NoteEditor slug={slug} variant={variant} />, { wrapper });

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
    expect(sendMessage).toHaveBeenCalledWith('saveNote', { slug, text: 'Edited note' });

    await act(async () => save.resolve());
    await waitFor(() => expect(textarea).toBeEnabled());
  });

  it('shows the full over-limit count and prevents saving', () => {
    const { wrapper, queryClient } = createTestWrapper();
    queryClient.setQueryData(noteQueryKeys.detail(slug), null);
    render(<NoteEditor slug={slug} variant={variant} />, { wrapper });

    expect(screen.queryByRole('button', { name: 'Delete' })).not.toBeInTheDocument();
    const textarea = screen.getByRole('textbox', { name: 'Note text' });
    const text = 'a'.repeat(NOTES_MAX_LENGTH + 1);
    fireEvent.change(textarea, { target: { value: text } });
    expect(textarea).toHaveValue(text);
    expect(textarea).not.toHaveAttribute('maxlength');
    expect(screen.getByText('501/500')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Save' })).toBeDisabled();
  });

  it.each(['Stored note'])('confirms deletion of stored text "%s" and shows pending feedback', async (text) => {
    const remove = Promise.withResolvers<void>();
    messages.handle('deleteNote', async () => {
      await remove.promise;
      vi.mocked(storage.getItem).mockResolvedValue(buildLearningDocument());
      await storage.setItem(STORAGE_KEYS.learningDocument, buildLearningDocument());
    });
    const { wrapper, queryClient } = createTestWrapper();
    vi.mocked(storage.getItem).mockResolvedValue(
      buildLearningDocument({ cards: { [slug]: createMockCard(State.New, { slug, note: text }) } })
    );
    queryClient.setQueryData(noteQueryKeys.detail(slug), text);
    render(<NoteEditor slug={slug} variant={variant} />, { wrapper });

    fireEvent.click(screen.getByRole('button', { name: 'Delete' }));
    const confirm = await screen.findByRole('button', { name: 'Confirm?' });
    expect(sendMessage).not.toHaveBeenCalledWith('deleteNote', expect.anything());
    fireEvent.click(confirm);
    expect(await screen.findByRole('button', { name: 'Deleting...' })).toBeDisabled();
    expect(sendMessage).toHaveBeenCalledWith('deleteNote', { slug });

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
    const { wrapper, queryClient } = createTestWrapper();
    vi.mocked(storage.getItem).mockResolvedValue(
      buildLearningDocument({ cards: { [slug]: createMockCard(State.New, { slug, note: 'Stored note' }) } })
    );
    queryClient.setQueryData(noteQueryKeys.detail(slug), 'Stored note');
    render(<NoteEditor slug={slug} variant={variant} />, { wrapper });
    const textarea = screen.getByRole('textbox', { name: 'Note text' });

    fireEvent.change(textarea, { target: { value: 'Failed draft' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Could not save your note. Your draft is kept. Try saving again.'
    );
    expect(textarea).toHaveValue('Failed draft');
    expect(screen.getByRole('button', { name: 'Save' })).toBeEnabled();

    messages.handle('saveNote', async ({ text }) => {
      const saved = buildLearningDocument({ cards: { [slug]: createMockCard(State.New, { slug, note: text }) } });
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
    const { wrapper } = createTestWrapper();
    const view = render(<NoteEditor slug={slug} variant={variant} />, { wrapper });
    const textarea = screen.getByRole('textbox', { name: 'Note text' });
    await waitFor(() => expect(textarea).toBeEnabled());
    fireEvent.change(textarea, { target: { value: 'Unsaved draft' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));
    await screen.findByRole('alert');

    view.rerender(<NoteEditor slug="another-card" variant={variant} />);
    await waitFor(() => expect(screen.queryByRole('alert')).not.toBeInTheDocument());
    expect(textarea).toHaveValue('');
  });

  it('retains text and resets confirmation after a failed deletion', async () => {
    const error = new Error('Delete failed');
    const log = vi.spyOn(console, 'error').mockImplementation(() => {});
    messages.handle('deleteNote', () => Promise.reject(error));
    const { wrapper, queryClient } = createTestWrapper();
    vi.mocked(storage.getItem).mockResolvedValue(
      buildLearningDocument({ cards: { [slug]: createMockCard(State.New, { slug, note: 'Stored note' }) } })
    );
    queryClient.setQueryData(noteQueryKeys.detail(slug), 'Stored note');
    render(<NoteEditor slug={slug} variant={variant} />, { wrapper });

    fireEvent.click(screen.getByRole('button', { name: 'Delete' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Confirm?' }));
    await waitFor(() => expect(log).toHaveBeenCalledWith('Failed to delete note:', error));
    expect(await screen.findByRole('button', { name: 'Delete' })).toBeEnabled();
    expect(screen.getByRole('textbox', { name: 'Note text' })).toHaveValue('Stored note');
  });
});

describe('NoteEditor autosizing', () => {
  const slug = 'autosize-card';
  const messages = createMessageMock(vi.mocked(sendMessage));

  beforeEach(() => {
    fakeBrowser.reset();
    vi.spyOn(storage, 'getItem').mockResolvedValue(buildLearningDocument());
    messages.reset();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('sizes compact notes after fetching and grows, caps, and shrinks with edits', async () => {
    const note = Promise.withResolvers<string | null>();
    vi.mocked(storage.getItem).mockImplementation(() =>
      note.promise.then((text) =>
        buildLearningDocument({ cards: { [slug]: createMockCard(State.New, { slug, note: text ?? undefined }) } })
      )
    );
    let contentHeight = 24;
    vi.spyOn(HTMLElement.prototype, 'scrollHeight', 'get').mockImplementation(function (this: HTMLElement) {
      return this.style.height === 'auto'
        ? contentHeight
        : Math.max(contentHeight, Number.parseFloat(this.style.height));
    });
    const { wrapper } = createTestWrapper();
    render(<NoteEditor slug={slug} variant="compact" />, { wrapper });
    const textarea = screen.getByRole('textbox', { name: 'Note text' });
    expect(textarea).toHaveStyle({ height: '24px' });

    contentHeight = 48;
    await act(async () => note.resolve('Fetched note'));
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
    vi.mocked(storage.getItem).mockResolvedValue(
      buildLearningDocument({ cards: { [slug]: createMockCard(State.New, { slug, note: 'Stored note' }) } })
    );
    queryClient.setQueryData(noteQueryKeys.detail(slug), 'Stored note');
    const { rerender } = render(<NoteEditor slug={slug} variant="regular" />, { wrapper });
    const textarea = screen.getByRole('textbox', { name: 'Note text' });

    fireEvent.change(textarea, { target: { value: 'Edited note' } });
    expect(textarea.style.height).toBe('');
    expect(measure).not.toHaveBeenCalled();

    rerender(<NoteEditor slug={slug} variant="compact" />);
    expect(textarea).toHaveStyle({ height: '96px' });

    rerender(<NoteEditor slug={slug} variant="regular" />);
    expect(textarea.style.height).toBe('');
    expect(textarea).toHaveValue('Edited note');
  });
});
