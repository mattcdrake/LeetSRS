/**
 * @vitest-environment happy-dom
 */

import { act, fireEvent, render, screen } from '@testing-library/react';
import { State } from 'ts-fsrs';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { sendMessage } from '@/shared/messages';
import type { CardWithProblem } from '@/shared/models';
import { createMockCardWithProblem } from '@/test/utils/card-mocks';
import { createMessageMock } from '@/test/utils/message-mocks';
import { createTestWrapper } from '@/test/utils/test-wrapper';
import { CardListItem } from '../CardListItem';

vi.mock('@/shared/messages', () => ({ sendMessage: vi.fn() }));
vi.mock('@/popup/components/notes/NoteEditor', () => ({ NoteEditor: () => null }));

const messages = createMessageMock(vi.mocked(sendMessage));
let wrapper: ReturnType<typeof createTestWrapper>['wrapper'];

const renderItem = (card: CardWithProblem) => {
  render(<CardListItem card={card} />, { wrapper });
  fireEvent.click(screen.getByRole('button', { expanded: false }));
};

describe('CardListItem', () => {
  beforeEach(() => {
    messages.reset().resolve('setPauseStatus', undefined).resolve('removeCard', undefined);
    wrapper = createTestWrapper().wrapper;
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it.each([0, undefined])('renders numeric dates with last_review=%s', (lastReview) => {
    const card = createMockCardWithProblem(State.Review, { createdAt: 0 });
    card.fsrs.due = 0;
    if (lastReview === undefined) {
      delete card.fsrs.last_review;
    } else {
      card.fsrs.last_review = lastReview;
    }
    renderItem(card);

    const epochDate = new Date(0).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
    expect(screen.getByText('Due:').parentElement).toHaveTextContent(`Due:${epochDate}`);
    expect(screen.getByText('Added:').parentElement).toHaveTextContent(`Added:${epochDate}`);
    if (lastReview === undefined) {
      expect(screen.queryByText('Last:')).not.toBeInTheDocument();
    } else {
      expect(screen.getByText('Last:').parentElement).toHaveTextContent(`Last:${epochDate}`);
    }
  });

  it.each([
    { paused: false, action: 'Pause', nextPaused: true },
    { paused: true, action: 'Resume', nextPaused: false },
  ])('sends the $action mutation for its card', async ({ paused, action, nextPaused }) => {
    const card = createMockCardWithProblem(State.New, { slug: 'test-problem', paused });
    renderItem(card);

    fireEvent.click(screen.getByRole('button', { name: action }));

    await vi.waitFor(() =>
      expect(sendMessage).toHaveBeenCalledWith('setPauseStatus', { frontendId: '1', paused: nextPaused })
    );
  });

  it('deletes only after confirmation', async () => {
    renderItem(createMockCardWithProblem(State.New, { slug: 'test-problem' }));

    fireEvent.click(screen.getByRole('button', { name: 'Delete' }));
    expect(screen.getByRole('button', { name: 'Confirm?' })).toBeInTheDocument();
    expect(sendMessage).not.toHaveBeenCalledWith('removeCard', expect.anything());

    fireEvent.click(screen.getByRole('button', { name: 'Confirm?' }));

    await vi.waitFor(() => {
      expect(sendMessage).toHaveBeenCalledWith('removeCard', { frontendId: '1' });
    });
  });

  it('expires delete confirmation', () => {
    vi.useFakeTimers();
    renderItem(createMockCardWithProblem(State.New));

    fireEvent.click(screen.getByRole('button', { name: 'Delete' }));
    expect(screen.getByRole('button', { name: 'Confirm?' })).toBeInTheDocument();

    act(() => vi.advanceTimersByTime(3000));

    expect(screen.getByRole('button', { name: 'Delete' })).toBeInTheDocument();
    expect(sendMessage).not.toHaveBeenCalledWith('removeCard', expect.anything());
  });

  it('restores its pause action after a failure', async () => {
    const error = new Error('Pause failed');
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});
    messages.handle('setPauseStatus', () => Promise.reject(error));
    renderItem(createMockCardWithProblem(State.New));

    const pauseButton = screen.getByRole('button', { name: 'Pause' });
    fireEvent.click(pauseButton);

    await vi.waitFor(() => {
      expect(consoleError).toHaveBeenCalledWith('Failed to toggle pause status:', error);
      expect(pauseButton).not.toBeDisabled();
    });
  });

  it('restores delete confirmation after a failure', async () => {
    const error = new Error('Delete failed');
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});
    messages.handle('removeCard', () => Promise.reject(error));
    renderItem(createMockCardWithProblem(State.New));

    fireEvent.click(screen.getByRole('button', { name: 'Delete' }));
    fireEvent.click(screen.getByRole('button', { name: 'Confirm?' }));

    await vi.waitFor(() => {
      expect(consoleError).toHaveBeenCalledWith('Failed to delete card:', error);
      expect(screen.getByRole('button', { name: 'Delete' })).not.toBeDisabled();
    });
  });

  it('keeps overlapping operations on different cards independent', async () => {
    const pauseResult = Promise.withResolvers<void>();
    const deleteResult = Promise.withResolvers<void>();
    messages.handle('setPauseStatus', () => pauseResult.promise).handle('removeCard', () => deleteResult.promise);
    const cards = [
      createMockCardWithProblem(State.New, { frontendId: 'first', name: 'First', slug: 'first' }),
      createMockCardWithProblem(State.New, { frontendId: 'second', name: 'Second', slug: 'second' }),
    ];

    render(
      cards.map((card) => <CardListItem key={card.frontendId} card={card} />),
      { wrapper }
    );

    for (const toggle of screen.getAllByRole('button', { expanded: false })) fireEvent.click(toggle);
    const pauseButtons = screen.getAllByRole('button', { name: 'Pause' });
    const deleteButtons = screen.getAllByRole('button', { name: 'Delete' });
    fireEvent.click(pauseButtons[0]);
    fireEvent.click(deleteButtons[1]);
    fireEvent.click(screen.getByRole('button', { name: 'Confirm?' }));

    await vi.waitFor(() => {
      expect(pauseButtons[0]).toBeDisabled();
      expect(pauseButtons[1]).not.toBeDisabled();
      expect(deleteButtons[0]).not.toBeDisabled();
      expect(deleteButtons[1]).toBeDisabled();
    });

    await act(async () => {
      pauseResult.resolve();
      deleteResult.resolve();
      await Promise.all([pauseResult.promise, deleteResult.promise]);
    });
  });
});
