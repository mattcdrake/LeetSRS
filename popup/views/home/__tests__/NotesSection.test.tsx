import { storage } from '#imports';
import { STORAGE_KEYS } from '@/data/storage-keys';
import { LearningState as State } from '@/domain/scheduling';
import { createMockCard } from '@/test/utils/card-mocks';
import { buildLearningDocument, setPopupLearningCardsQueryData } from '@/test/utils/learning-document-mocks';
/**
 * @vitest-environment happy-dom
 */

import type { QueryClient } from '@tanstack/react-query';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { sendMessage } from '@/integrations/browser/messages';
import { learningDocumentQueryKey, type PopupLearningDocumentSnapshot } from '@/popup/queries/learning-document';
import { createMessageMock } from '@/test/utils/message-mocks';
import { createPopupTestWrapper } from '@/test/utils/test-wrapper';
import { NotesSection } from '../NotesSection';

vi.mock('@/integrations/browser/messages', () => ({ sendMessage: vi.fn() }));

describe('NotesSection', () => {
  const mockSlug = 'test-card-123';
  const messages = createMessageMock(vi.mocked(sendMessage));
  let wrapper: ReturnType<typeof createPopupTestWrapper>['wrapper'];
  let queryClient: QueryClient;

  const seedNote = (note: string | null) => {
    void storage.setItem(
      STORAGE_KEYS.learningDocument,
      buildLearningDocument({
        cards: { [mockSlug]: createMockCard(State.New, { slug: mockSlug, note: note ?? undefined }) },
      })
    );
    setPopupLearningCardsQueryData(queryClient, [
      createMockCard(State.New, { slug: mockSlug, note: note ?? undefined }),
    ]);
  };

  beforeEach(() => {
    messages.reset().resolve('saveNote', undefined).resolve('deleteNote', undefined);
    ({ wrapper, queryClient } = createPopupTestWrapper());
    seedNote(null);
  });

  it('should render collapsed by default', () => {
    render(<NotesSection slug={mockSlug} />, { wrapper });

    expect(screen.getByText('Notes')).toBeInTheDocument();
    expect(screen.getByRole('button', { expanded: false })).toBeInTheDocument();
    expect(screen.getByPlaceholderText(/add your notes/i)).not.toBeVisible();
    expect(screen.queryByRole('textbox')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Save' })).not.toBeInTheDocument();
  });

  it('should expand when clicked', async () => {
    render(<NotesSection slug={mockSlug} />, { wrapper });

    const expandButton = screen.getByRole('button', { expanded: false });
    fireEvent.click(expandButton);

    await waitFor(() => {
      expect(screen.getByRole('button', { expanded: true })).toBeInTheDocument();
      expect(screen.getByPlaceholderText('Add your notes here...')).toBeInTheDocument();
    });
  });

  it('disables an expanded note editor while its review action is pending', async () => {
    seedNote('Stored note');
    const view = render(<NotesSection slug={mockSlug} />, { wrapper });
    fireEvent.click(screen.getByRole('button', { expanded: false }));
    const textarea = await screen.findByRole('textbox', { name: 'Note text' });
    fireEvent.change(textarea, { target: { value: 'Unsaved draft' } });
    expect(screen.getByRole('button', { name: 'Save' })).toBeEnabled();

    view.rerender(<NotesSection slug={mockSlug} isDisabled />);

    expect(screen.getByRole('button', { expanded: true })).toBeDisabled();
    expect(textarea).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Delete' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Save' })).toBeDisabled();
  });

  it('retains the draft and delete confirmation across collapse and reopen', async () => {
    seedNote('Stored note');
    render(<NotesSection slug={mockSlug} />, { wrapper });
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
    messages.handle('saveNote', async ({ text }) => {
      await save.promise;
      seedNote(text);
    });
    render(<NotesSection slug={mockSlug} />, { wrapper });
    const toggle = screen.getByRole('button', { expanded: false });
    fireEvent.click(toggle);
    fireEvent.change(screen.getByRole('textbox'), { target: { value: 'Saved draft' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));
    expect(await screen.findByRole('button', { name: 'Saving...' })).toBeDisabled();

    fireEvent.click(toggle);
    await act(async () => save.resolve());
    await waitFor(() =>
      expect(
        queryClient.getQueryData<PopupLearningDocumentSnapshot>(learningDocumentQueryKey)?.document.cards[mockSlug]
      ).toMatchObject({ slug: mockSlug, note: 'Saved draft' })
    );
    expect(screen.queryByRole('textbox')).not.toBeInTheDocument();

    fireEvent.click(toggle);
    expect(screen.getByRole('textbox')).toHaveValue('Saved draft');
    expect(screen.getByRole('textbox')).toBeEnabled();
    expect(screen.getByRole('button', { name: 'Save' })).toBeDisabled();
    expect(sendMessage).toHaveBeenCalledWith('saveNote', { slug: mockSlug, text: 'Saved draft' });
  });

  it('loads the supplied card while collapsed and saves edits to that card', async () => {
    const slug = 'another-home-card';
    await storage.setItem(
      STORAGE_KEYS.learningDocument,
      buildLearningDocument({ cards: { [slug]: createMockCard(State.New, { slug, note: 'This card note' }) } })
    );
    render(<NotesSection slug={slug} />, { wrapper });

    await waitFor(() => expect(screen.getByRole('textbox', { hidden: true })).toHaveValue('This card note'));
    fireEvent.click(screen.getByRole('button', { expanded: false }));
    fireEvent.change(screen.getByRole('textbox', { name: 'Note text' }), { target: { value: 'Edited card note' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));
    await waitFor(() => expect(sendMessage).toHaveBeenCalledWith('saveNote', { slug, text: 'Edited card note' }));
  });
});
