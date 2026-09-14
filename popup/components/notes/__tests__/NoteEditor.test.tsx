/** @vitest-environment happy-dom */
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fakeBrowser } from 'wxt/testing/fake-browser';
import { storage } from '#imports';
import { replaceLearningDocument } from '@/data/learning-document';
import { STORAGE_KEYS } from '@/data/storage-keys';
import { NOTES_MAX_LENGTH } from '@/domain/cards';
import { LearningState as State } from '@/domain/scheduling';
import { sendMessage } from '@/integrations/browser/messages';
import { useCardsQuery } from '@/popup/queries/cards';
import { createMockCard } from '@/test/utils/card-mocks';
import { buildLearningDocument, setPopupLearningCardsQueryData } from '@/test/utils/learning-document-mocks';
import { createMessageMock } from '@/test/utils/message-mocks';
import { createPopupTestWrapper } from '@/test/utils/test-wrapper';
import { NoteEditor } from '../NoteEditor';

vi.mock('@/integrations/browser/messages', () => ({ sendMessage: vi.fn() }));

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
    const { wrapper, queryClient } = createPopupTestWrapper();
    vi.mocked(storage.getItem).mockResolvedValue(
      buildLearningDocument({ cards: { [slug]: createMockCard(State.New, { slug, note: 'Stored note' }) } })
    );
    setPopupLearningCardsQueryData(queryClient, [createMockCard(State.New, { slug, note: 'Stored note' })]);
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
    const { wrapper } = createPopupTestWrapper();
    render(<NoteEditor slug={slug} variant={variant} />, { wrapper });

    const textarea = screen.getByRole('textbox', { name: 'Note text' });
    expect(textarea).toBeDisabled();
    expect(textarea).toHaveAttribute('placeholder', 'Loading...');
    await waitFor(() => expect(textarea).toHaveValue('Stored note'));
    expect(screen.getByRole('button', { name: 'Save' })).toBeDisabled();

    fireEvent.change(textarea, { target: { value: '  Edited note\n' } });
    expect(screen.getByText('14/500')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));
    expect(await screen.findByRole('button', { name: 'Saving...' })).toBeDisabled();
    expect(textarea).toBeDisabled();
    expect(sendMessage).toHaveBeenCalledWith('saveNote', { slug, text: '  Edited note\n' });

    await act(async () => save.resolve());
    await waitFor(() => expect(textarea).toBeEnabled());
  });

  it('shows the full over-limit count and prevents saving', () => {
    const { wrapper, queryClient } = createPopupTestWrapper();
    setPopupLearningCardsQueryData(queryClient, [createMockCard(State.New, { slug, note: undefined })]);
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

  it('confirms deletion and shows pending feedback', async () => {
    const text = 'Stored note';
    const remove = Promise.withResolvers<void>();
    messages.handle('deleteNote', async () => {
      await remove.promise;
      vi.mocked(storage.getItem).mockResolvedValue(buildLearningDocument());
      await storage.setItem(STORAGE_KEYS.learningDocument, buildLearningDocument());
    });
    const { wrapper, queryClient } = createPopupTestWrapper();
    vi.mocked(storage.getItem).mockResolvedValue(
      buildLearningDocument({ cards: { [slug]: createMockCard(State.New, { slug, note: text }) } })
    );
    setPopupLearningCardsQueryData(queryClient, [createMockCard(State.New, { slug, note: text })]);
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
    const { wrapper, queryClient } = createPopupTestWrapper();
    vi.mocked(storage.getItem).mockResolvedValue(
      buildLearningDocument({ cards: { [slug]: createMockCard(State.New, { slug, note: 'Stored note' }) } })
    );
    setPopupLearningCardsQueryData(queryClient, [createMockCard(State.New, { slug, note: 'Stored note' })]);
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
      const saved = buildLearningDocument({
        cards: { [slug]: createMockCard(State.New, { slug, note: text }) },
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

  it('preserves a dirty draft during incoming updates and resets it and confirmation when switching cards', async () => {
    const { wrapper, queryClient } = createPopupTestWrapper();
    setPopupLearningCardsQueryData(queryClient, [
      createMockCard(State.New, { slug, note: 'Stored note' }),
      createMockCard(State.New, { slug: 'another-card', note: 'Other note' }),
    ]);
    vi.mocked(storage.getItem).mockResolvedValue(
      buildLearningDocument({
        cards: {
          [slug]: createMockCard(State.New, { slug, note: 'Incoming note' }),
          'another-card': createMockCard(State.New, { slug: 'another-card', note: 'Other note' }),
        },
      })
    );
    const view = render(<NoteEditor slug={slug} variant={variant} />, { wrapper });
    const textarea = screen.getByRole('textbox', { name: 'Note text' });
    fireEvent.change(textarea, { target: { value: 'Dirty draft' } });
    act(() =>
      setPopupLearningCardsQueryData(queryClient, [
        createMockCard(State.New, { slug, note: 'Incoming note' }),
        createMockCard(State.New, { slug: 'another-card', note: 'Other note' }),
      ])
    );
    expect(textarea).toHaveValue('Dirty draft');
    fireEvent.click(screen.getByRole('button', { name: 'Delete' }));
    await screen.findByRole('button', { name: 'Confirm?' });

    view.rerender(<NoteEditor slug="another-card" variant={variant} />);
    expect(textarea).toHaveValue('Other note');
    expect(screen.queryByRole('button', { name: 'Confirm?' })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Save' })).toBeDisabled();
    view.rerender(<NoteEditor slug={slug} variant={variant} />);
    expect(textarea).toHaveValue('Incoming note');
  });

  it('retains text and resets confirmation after a failed deletion', async () => {
    const error = new Error('Delete failed');
    const log = vi.spyOn(console, 'error').mockImplementation(() => {});
    messages.handle('deleteNote', () => Promise.reject(error));
    const { wrapper, queryClient } = createPopupTestWrapper();
    vi.mocked(storage.getItem).mockResolvedValue(
      buildLearningDocument({ cards: { [slug]: createMockCard(State.New, { slug, note: 'Stored note' }) } })
    );
    setPopupLearningCardsQueryData(queryClient, [createMockCard(State.New, { slug, note: 'Stored note' })]);
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
    const { wrapper } = createPopupTestWrapper();
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
    const { wrapper, queryClient } = createPopupTestWrapper();
    vi.mocked(storage.getItem).mockResolvedValue(
      buildLearningDocument({ cards: { [slug]: createMockCard(State.New, { slug, note: 'Stored note' }) } })
    );
    setPopupLearningCardsQueryData(queryClient, [createMockCard(State.New, { slug, note: 'Stored note' })]);
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

it('shares card reads across editors mounted separately and refreshes them with one read', async () => {
  fakeBrowser.reset();
  const first = createMockCard(State.New, { id: 'first', slug: 'first', note: 'First note' });
  const second = createMockCard(State.New, { id: 'second', slug: 'second', note: 'Second note' });
  await replaceLearningDocument(buildLearningDocument({ cards: { first, second } }));
  const reads = vi.spyOn(storage, 'getItem');
  const { wrapper } = createPopupTestWrapper();
  function Editors({ expanded }: { expanded: boolean }) {
    const { data: cards = [] } = useCardsQuery();
    return (
      <>
        {cards.map((card, index) =>
          index === 0 || expanded ? <NoteEditor key={card.slug} slug={card.slug} variant="compact" /> : null
        )}
      </>
    );
  }
  const view = render(<Editors expanded={false} />, { wrapper });
  await screen.findByDisplayValue('First note');
  reads.mockClear();
  view.rerender(<Editors expanded />);
  await screen.findByDisplayValue('Second note');
  expect(reads.mock.calls.filter(([key]) => key === STORAGE_KEYS.learningDocument)).toHaveLength(0);

  await act(() =>
    replaceLearningDocument(
      buildLearningDocument({
        cards: {
          first: { ...first, note: 'Updated first' },
          second: { ...second, note: 'Updated second' },
        },
      })
    )
  );
  await screen.findByDisplayValue('Updated first');
  await screen.findByDisplayValue('Updated second');
  expect(reads.mock.calls.filter(([key]) => key === STORAGE_KEYS.learningDocument)).toHaveLength(1);
  reads.mockRestore();
});
