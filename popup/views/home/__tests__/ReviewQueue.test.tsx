import { storage } from '#imports';
import { initializeCatalog } from '@/shared/catalog';
import { buildLearningDocument, setPopupLearningCardsQueryData } from '@/test/utils/learning-document-mocks';
/**
 * @vitest-environment happy-dom
 */

import type { QueryClient } from '@tanstack/react-query';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { Rating, State } from 'ts-fsrs';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { CardWithProblem } from '@/popup/queries/cards';
import { sendMessage } from '@/shared/messages';
import { createMockCardWithProblem } from '@/test/utils/card-mocks';
import { createMessageMock } from '@/test/utils/message-mocks';
import { createPopupTestWrapper } from '@/test/utils/test-wrapper';
import { ReviewQueue } from '../ReviewQueue';

vi.mock('@/shared/messages', () => ({ sendMessage: vi.fn() }));

// Mock the child components
interface MockReviewCardProps {
  card: { title: string };
  onRate: (rating: Rating) => void;
  isProcessing: boolean;
}

vi.mock('../ReviewCard', () => ({
  ReviewCard: ({ card, onRate, isProcessing }: MockReviewCardProps) => (
    <div data-testid="review-card">
      <div>{card.title}</div>
      <button type="button" onClick={() => onRate(Rating.Again)} disabled={isProcessing}>
        Again
      </button>
      <button type="button" onClick={() => onRate(Rating.Hard)} disabled={isProcessing}>
        Hard
      </button>
      <button type="button" onClick={() => onRate(Rating.Good)} disabled={isProcessing}>
        Good
      </button>
      <button type="button" onClick={() => onRate(Rating.Easy)} disabled={isProcessing}>
        Easy
      </button>
    </div>
  ),
}));

vi.mock('../NotesSection', () => ({
  NotesSection: ({ frontendId, isDisabled }: { frontendId: string; isDisabled: boolean }) => (
    <div data-testid="notes-section">
      Notes for {frontendId}
      <button type="button" disabled={isDisabled}>
        Edit note
      </button>
    </div>
  ),
}));

vi.mock('../ActionsSection', () => ({
  ActionsSection: ({
    onDelete,
    onDelay,
    onPause,
    isDisabled,
  }: {
    onDelete: () => void;
    onDelay: (days: number) => void;
    onPause: () => void;
    isDisabled: boolean;
  }) => (
    <div data-testid="actions-section">
      <button type="button" onClick={onDelete} data-testid="delete-button" disabled={isDisabled}>
        Delete
      </button>
      <button type="button" onClick={() => onDelay(1)} data-testid="delay-1-button" disabled={isDisabled}>
        Delay 1 day
      </button>
      <button type="button" onClick={() => onDelay(5)} data-testid="delay-5-button" disabled={isDisabled}>
        Delay 5 days
      </button>
      <button type="button" onClick={onPause} data-testid="pause-button" disabled={isDisabled}>
        Pause
      </button>
    </div>
  ),
}));

describe('ReviewQueue', () => {
  const mockCards = [
    createMockCardWithProblem(State.Learning, {
      slug: 'two-sum',
      title: 'Two Sum',
      frontendId: '1',
      difficulty: 'easy',
    }),
    createMockCardWithProblem(State.Learning, {
      slug: 'add-two-numbers',
      title: 'Add Two Numbers',
      frontendId: '2',
      difficulty: 'medium',
    }),
    createMockCardWithProblem(State.Learning, {
      slug: 'longest-substring',
      title: 'Longest Substring',
      frontendId: '3',
      difficulty: 'medium',
    }),
  ];

  const mockMutateAsync = vi.fn();
  const messages = createMessageMock(vi.mocked(sendMessage));
  let wrapper: React.ComponentType<{ children: React.ReactNode }>;
  let queryClient: QueryClient;
  const seedQueue = (cards: CardWithProblem[]) => {
    vi.mocked(storage.getItem).mockResolvedValue(
      buildLearningDocument({ cards: Object.fromEntries(cards.map((card) => [card.frontendId, card])) })
    );
    setPopupLearningCardsQueryData(queryClient, cards);
  };

  beforeEach(() => {
    vi.spyOn(storage, 'getItem');
    messages
      .reset()
      .resolve('waitForInitialization', undefined)
      .handle('rateCard', mockMutateAsync)
      .resolve('removeCard', undefined)
      .resolve('delayCard', undefined)
      .resolve('setPauseStatus', undefined);
    mockMutateAsync.mockReset();

    ({ wrapper, queryClient } = createPopupTestWrapper());
    mockCards.forEach((card, index) => {
      card.fsrs.due = index;
    });
    seedQueue(mockCards);
    mockMutateAsync.mockResolvedValue(undefined);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('Processing State', () => {
    it('keeps controls disabled after the command until the queue refresh completes', async () => {
      const mutation = Promise.withResolvers<void>();
      const refresh = Promise.withResolvers<ReturnType<typeof buildLearningDocument>>();
      mockMutateAsync.mockReturnValue(mutation.promise);
      render(<ReviewQueue />, { wrapper });

      const goodButton = await screen.findByRole('button', { name: 'Good' });
      vi.mocked(storage.getItem).mockReturnValue(refresh.promise);
      fireEvent.click(goodButton);
      mutation.resolve();
      await act(async () => Promise.resolve());
      expect(goodButton).toBeDisabled();
      expect(screen.getByText('Two Sum')).toBeInTheDocument();

      refresh.resolve(
        buildLearningDocument({ cards: Object.fromEntries(mockCards.slice(1).map((card) => [card.frontendId, card])) })
      );
      await waitFor(() => expect(screen.getByText('Add Two Numbers')).toBeInTheDocument());
      expect(screen.getByRole('button', { name: 'Good' })).toBeEnabled();
    });

    it('does not render a cache update until the command also completes', async () => {
      const mutation = Promise.withResolvers<void>();
      mockMutateAsync.mockReturnValue(mutation.promise);
      render(<ReviewQueue />, { wrapper });

      await waitFor(() => expect(queryClient.isFetching()).toBe(0));
      fireEvent.click(await screen.findByRole('button', { name: 'Good' }));
      await act(async () => seedQueue(mockCards.slice(1)));

      await waitFor(() => expect(screen.getByText('Loading review queue...')).toBeInTheDocument());
      expect(screen.queryByText('Two Sum')).not.toBeInTheDocument();
      expect(screen.queryByText('Add Two Numbers')).not.toBeInTheDocument();
      expect(screen.queryByTestId('pause-button')).not.toBeInTheDocument();

      mutation.resolve();

      await waitFor(() => expect(screen.getByText('Add Two Numbers')).toBeInTheDocument());
      expect(screen.getByRole('button', { name: 'Good' })).not.toBeDisabled();
      expect(screen.getByTestId('pause-button')).not.toBeDisabled();
    });

    it('shows the empty state after the final card command and queue refresh complete', async () => {
      render(<ReviewQueue />, { wrapper });

      await waitFor(() => expect(queryClient.isFetching()).toBe(0));
      fireEvent.click(await screen.findByRole('button', { name: 'Good' }));
      await act(async () => seedQueue([]));

      await waitFor(() => expect(screen.getByText('No cards to review!')).toBeInTheDocument());
      expect(screen.queryByTestId('review-card')).not.toBeInTheDocument();
    });
  });

  describe('Error Handling', () => {
    it('should handle rating errors gracefully', async () => {
      mockMutateAsync.mockRejectedValue(new Error('Failed to rate card'));
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      render(<ReviewQueue />, { wrapper });

      // Wait for initial render
      await waitFor(() => {
        expect(screen.getByText('Two Sum')).toBeInTheDocument();
      });

      const goodButton = screen.getByRole('button', { name: 'Good' });
      fireEvent.click(goodButton);

      await waitFor(() => {
        expect(consoleSpy).toHaveBeenCalledWith('Failed to rate card:', expect.any(Error));
      });

      // Card should still be displayed (not removed from queue)
      expect(screen.getByText('Two Sum')).toBeInTheDocument();

      // Buttons should be re-enabled after error
      expect(goodButton).not.toBeDisabled();

      consoleSpy.mockRestore();
    });
  });

  describe('Card Actions', () => {
    it('should disable controls and prevent duplicate actions while a review is pending', async () => {
      const mutation = Promise.withResolvers<void>();
      messages.handle('rateCard', () => mutation.promise);
      render(<ReviewQueue />, { wrapper });

      const actionButton = await screen.findByRole('button', { name: 'Good' });
      const controls = screen.getAllByRole('button');
      for (const control of controls) expect(control).toBeEnabled();

      vi.mocked(sendMessage).mockClear();
      fireEvent.click(actionButton);
      for (const control of controls) fireEvent.click(control);
      fireEvent.click(actionButton);

      await waitFor(() =>
        expect(vi.mocked(sendMessage).mock.calls.filter(([name]) => name === 'rateCard')).toHaveLength(1)
      );
      expect(sendMessage).toHaveBeenCalledWith('rateCard', expect.any(Object));
      for (const control of controls) expect(control).toBeDisabled();

      mutation.resolve();
      await waitFor(() => {
        for (const control of controls) expect(control).toBeEnabled();
      });
      expect(vi.mocked(sendMessage).mock.calls.filter(([name]) => name === 'rateCard')).toHaveLength(1);
    });
  });
});

beforeEach(initializeCatalog);
