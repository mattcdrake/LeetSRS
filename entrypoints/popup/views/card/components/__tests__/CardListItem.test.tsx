/**
 * @vitest-environment happy-dom
 */

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, fireEvent, render, screen } from '@testing-library/react';
import { State } from 'ts-fsrs';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Card } from '@/shared/cards';
import { sendMessage } from '@/shared/messages';
import { createMockCard } from '@/test/utils/card-mocks';
import { createDeferred } from '@/test/utils/deferred';
import { createMessageMock } from '@/test/utils/message-mocks';
import { CardListItem } from '../CardListItem';

vi.mock('@/shared/messages', () => ({ sendMessage: vi.fn() }));
vi.mock('../CardNotes', () => ({ CardNotes: () => null }));

const messages = createMessageMock(vi.mocked(sendMessage));
let queryClient: QueryClient;

const renderItem = (card: Card, onDeleted = vi.fn()) => {
  render(
    <QueryClientProvider client={queryClient}>
      <CardListItem card={card} isExpanded onToggle={vi.fn()} onDeleted={onDeleted} />
    </QueryClientProvider>
  );
  return onDeleted;
};

describe('CardListItem', () => {
  beforeEach(() => {
    messages.reset().resolve('setPauseStatus', createMockCard(State.New)).resolve('removeCard', undefined);
    queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it.each([
    { paused: false, action: 'Pause', nextPaused: true },
    { paused: true, action: 'Resume', nextPaused: false },
  ])('sends the $action mutation for its card', async ({ paused, action, nextPaused }) => {
    const card = createMockCard(State.New, { slug: 'test-problem', paused });
    renderItem(card);

    fireEvent.click(screen.getByRole('button', { name: action }));

    await vi.waitFor(() =>
      expect(sendMessage).toHaveBeenCalledWith('setPauseStatus', { slug: 'test-problem', paused: nextPaused })
    );
  });

  it('deletes only after confirmation and reports successful deletion', async () => {
    const onDeleted = renderItem(createMockCard(State.New, { slug: 'test-problem' }));

    fireEvent.click(screen.getByRole('button', { name: 'Delete' }));
    expect(screen.getByRole('button', { name: 'Confirm?' })).toBeInTheDocument();
    expect(sendMessage).not.toHaveBeenCalledWith('removeCard', expect.anything());

    fireEvent.click(screen.getByRole('button', { name: 'Confirm?' }));

    await vi.waitFor(() => {
      expect(sendMessage).toHaveBeenCalledWith('removeCard', { slug: 'test-problem' });
      expect(onDeleted).toHaveBeenCalledOnce();
    });
  });

  it('expires delete confirmation', () => {
    vi.useFakeTimers();
    renderItem(createMockCard(State.New));

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
    renderItem(createMockCard(State.New));

    const pauseButton = screen.getByRole('button', { name: 'Pause' });
    fireEvent.click(pauseButton);

    await vi.waitFor(() => {
      expect(consoleError).toHaveBeenCalledWith('Failed to toggle pause status:', error);
      expect(pauseButton).not.toBeDisabled();
    });
  });

  it('restores delete confirmation after a failure without reporting deletion', async () => {
    const error = new Error('Delete failed');
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});
    messages.handle('removeCard', () => Promise.reject(error));
    const onDeleted = renderItem(createMockCard(State.New));

    fireEvent.click(screen.getByRole('button', { name: 'Delete' }));
    fireEvent.click(screen.getByRole('button', { name: 'Confirm?' }));

    await vi.waitFor(() => {
      expect(consoleError).toHaveBeenCalledWith('Failed to delete card:', error);
      expect(screen.getByRole('button', { name: 'Delete' })).not.toBeDisabled();
    });
    expect(onDeleted).not.toHaveBeenCalled();
  });

  it('keeps overlapping operations on different cards independent', async () => {
    const pauseResult = createDeferred<Card>();
    const deleteResult = createDeferred<void>();
    messages.handle('setPauseStatus', () => pauseResult.promise).handle('removeCard', () => deleteResult.promise);
    const cards = [
      createMockCard(State.New, { id: 'first', name: 'First', slug: 'first' }),
      createMockCard(State.New, { id: 'second', name: 'Second', slug: 'second' }),
    ];

    render(
      <QueryClientProvider client={queryClient}>
        {cards.map((card) => (
          <CardListItem key={card.id} card={card} isExpanded onToggle={vi.fn()} onDeleted={vi.fn()} />
        ))}
      </QueryClientProvider>
    );

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
      pauseResult.resolve(cards[0]);
      deleteResult.resolve();
      await Promise.all([pauseResult.promise, deleteResult.promise]);
    });
  });
});
