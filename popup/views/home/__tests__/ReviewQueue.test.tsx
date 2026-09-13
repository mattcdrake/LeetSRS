import { storage } from '#imports';
import { buildLearningDocument } from '@/test/utils/learning-document-mocks';
/**
 * @vitest-environment happy-dom
 */

import type { QueryClient } from '@tanstack/react-query';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { Rating, State } from 'ts-fsrs';
import { afterEach, beforeEach, describe, expect, it, type Mock, vi } from 'vitest';
import type { Card } from '@/domain/cards';
import { sendMessage } from '@/integrations/browser/messages';
import { cardQueryKeys } from '@/popup/queries/cards';
import { createMockCard } from '@/test/utils/card-mocks';
import { createMessageMock } from '@/test/utils/message-mocks';
import { createTestWrapper } from '@/test/utils/test-wrapper';
import { ReviewQueue } from '../ReviewQueue';

vi.mock('@/integrations/browser/messages', () => ({ sendMessage: vi.fn() }));

// Mock the child components
interface MockReviewCardProps {
  card: { name: string };
  onRate: (rating: Rating) => void;
  isProcessing: boolean;
}

vi.mock('../ReviewCard', () => ({
  ReviewCard: ({ card, onRate, isProcessing }: MockReviewCardProps) => (
    <div data-testid="review-card">
      <div>{card.name}</div>
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
  NotesSection: ({ slug, isDisabled }: { slug: string; isDisabled: boolean }) => (
    <div data-testid="notes-section">
      Notes for {slug}
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
    createMockCard(State.Learning, {
      id: '1',
      slug: 'two-sum',
      name: 'Two Sum',
      leetcodeId: '1',
      difficulty: 'Easy',
    }),
    createMockCard(State.Learning, {
      id: '2',
      slug: 'add-two-numbers',
      name: 'Add Two Numbers',
      leetcodeId: '2',
      difficulty: 'Medium',
    }),
    createMockCard(State.Learning, {
      id: '3',
      slug: 'longest-substring',
      name: 'Longest Substring',
      leetcodeId: '3',
      difficulty: 'Medium',
    }),
  ];

  const mockMutateAsync = vi.fn();
  const messages = createMessageMock(vi.mocked(sendMessage));
  let wrapper: React.ComponentType<{ children: React.ReactNode }>;
  let queryClient: QueryClient;
  const seedQueue = (cards: Card[]) => {
    vi.mocked(storage.getItem).mockResolvedValue(
      buildLearningDocument({ cards: Object.fromEntries(cards.map((card) => [card.slug, card])) })
    );
    queryClient.setQueryData(cardQueryKeys.reviewQueue, cards);
  };

  beforeEach(() => {
    vi.spyOn(storage, 'getItem');
    messages
      .reset()
      .handle('rateCard', mockMutateAsync)
      .resolve('removeCard', undefined)
      .resolve('delayCard', undefined)
      .resolve('setPauseStatus', undefined);
    mockMutateAsync.mockReset();

    ({ wrapper, queryClient } = createTestWrapper());
    mockCards.forEach((card, index) => {
      card.fsrs.due = index;
    });
    seedQueue(mockCards);
    mockMutateAsync.mockResolvedValue(undefined);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('Empty Queue', () => {
    it('should show empty state when no cards to review', async () => {
      seedQueue([]);

      render(<ReviewQueue />, { wrapper });

      // Wait for state to initialize
      await waitFor(() => {
        expect(screen.getByText('No cards to review!')).toBeInTheDocument();
        expect(screen.getByText(/Add problems on LeetCode/)).toBeInTheDocument();
        expect(screen.queryByTestId('review-card')).not.toBeInTheDocument();
        expect(screen.queryByTestId('delete-button')).not.toBeInTheDocument();
      });
    });
  });

  describe('Queue Display', () => {
    it('should display the first card in the queue', async () => {
      render(<ReviewQueue />, { wrapper });

      // Wait for state to initialize
      await waitFor(() => {
        expect(screen.getByText('Two Sum')).toBeInTheDocument();
        expect(screen.getByTestId('notes-section')).toBeInTheDocument();
        expect(screen.getByText('Notes for two-sum')).toBeInTheDocument();
        expect(screen.queryByText('Add Two Numbers')).not.toBeInTheDocument();
        expect(screen.queryByText('Longest Substring')).not.toBeInTheDocument();
      });
    });
  });

  describe('Card Rating', () => {
    it('should call mutation with correct parameters when rated', async () => {
      render(<ReviewQueue />, { wrapper });

      // Wait for initial render
      await waitFor(() => {
        expect(screen.getByText('Two Sum')).toBeInTheDocument();
      });

      const goodButton = screen.getByRole('button', { name: 'Good' });
      fireEvent.click(goodButton);

      await waitFor(() => {
        expect(mockMutateAsync).toHaveBeenCalledWith({
          input: {
            slug: 'two-sum',
            name: 'Two Sum',
            rating: Rating.Good,
            leetcodeId: '1',
            difficulty: 'Easy',
            domain: 'leetcode.com',
          },
        });
      });
    });
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
        buildLearningDocument({ cards: Object.fromEntries(mockCards.slice(1).map((card) => [card.slug, card])) })
      );
      await waitFor(() => expect(screen.getByText('Add Two Numbers')).toBeInTheDocument());
      expect(screen.getByRole('button', { name: 'Good' })).toBeEnabled();
    });

    it('does not render a cache update until the command also completes', async () => {
      const mutation = Promise.withResolvers<void>();
      mockMutateAsync.mockReturnValue(mutation.promise);
      render(<ReviewQueue />, { wrapper });

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

  describe('Card Deletion', () => {
    let mockRemoveMutateAsync: Mock<(data: { slug: string }) => Promise<void>>;

    beforeEach(() => {
      vi.spyOn(storage, 'getItem');
      mockRemoveMutateAsync = vi.fn();
      messages.handle('removeCard', mockRemoveMutateAsync);
    });

    it('should call delete mutation when delete button is clicked', async () => {
      mockRemoveMutateAsync.mockResolvedValue(undefined);

      render(<ReviewQueue />, { wrapper });

      // Wait for initial render
      await waitFor(() => {
        expect(screen.getByText('Two Sum')).toBeInTheDocument();
      });

      // Click delete button
      const deleteButton = screen.getByTestId('delete-button');
      fireEvent.click(deleteButton);

      // Verify the mutation was called with correct slug
      await waitFor(() => {
        expect(mockRemoveMutateAsync).toHaveBeenCalledWith({ slug: 'two-sum' });
      });
    });

    it('should handle delete errors gracefully', async () => {
      mockRemoveMutateAsync.mockRejectedValue(new Error('Failed to delete card'));
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      render(<ReviewQueue />, { wrapper });

      // Wait for initial render
      await waitFor(() => {
        expect(screen.getByText('Two Sum')).toBeInTheDocument();
      });

      const deleteButton = screen.getByTestId('delete-button');
      fireEvent.click(deleteButton);

      await waitFor(() => {
        expect(consoleSpy).toHaveBeenCalledWith('Failed to delete card:', expect.any(Error));
      });

      // Card should still be displayed (not removed from queue)
      expect(screen.getByText('Two Sum')).toBeInTheDocument();

      // Should be able to interact with card again after error
      const goodButton = screen.getByRole('button', { name: 'Good' });
      expect(goodButton).not.toBeDisabled();

      consoleSpy.mockRestore();
    });
  });

  describe('Card Delay', () => {
    let mockDelayMutateAsync: Mock<(data: { slug: string; days: number }) => Promise<void>>;

    beforeEach(() => {
      vi.spyOn(storage, 'getItem');
      mockDelayMutateAsync = vi.fn();
      messages.handle('delayCard', mockDelayMutateAsync);
    });

    it('should call delay mutation when delay buttons are clicked', async () => {
      mockDelayMutateAsync.mockResolvedValue(undefined);

      render(<ReviewQueue />, { wrapper });

      // Wait for initial render
      await waitFor(() => {
        expect(screen.getByText('Two Sum')).toBeInTheDocument();
      });

      // Click delay 1 day button
      const delay1Button = screen.getByTestId('delay-1-button');
      fireEvent.click(delay1Button);

      // Verify the mutation was called with correct params
      await waitFor(() => {
        expect(mockDelayMutateAsync).toHaveBeenCalledWith({
          slug: 'two-sum',
          days: 1,
        });
      });
    });

    it('should handle delay errors gracefully', async () => {
      mockDelayMutateAsync.mockRejectedValue(new Error('Failed to delay card'));
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      render(<ReviewQueue />, { wrapper });

      // Wait for initial render
      await waitFor(() => {
        expect(screen.getByText('Two Sum')).toBeInTheDocument();
      });

      const delay1Button = screen.getByTestId('delay-1-button');
      fireEvent.click(delay1Button);

      await waitFor(() => {
        expect(consoleSpy).toHaveBeenCalledWith('Failed to delay card:', expect.any(Error));
      });

      // Card should still be displayed (not removed from queue)
      expect(screen.getByText('Two Sum')).toBeInTheDocument();

      // Should be able to interact with card again after error
      const goodButton = screen.getByRole('button', { name: 'Good' });
      expect(goodButton).not.toBeDisabled();

      consoleSpy.mockRestore();
    });
  });

  describe('Card Actions', () => {
    it.each([
      ['Good', 'rateCard'],
      ['Delete', 'removeCard'],
      ['Delay 1 day', 'delayCard'],
      ['Pause', 'setPauseStatus'],
    ] as const)(
      'should disable controls and prevent duplicate actions while %s is pending',
      async (buttonName, message) => {
        const mutation = Promise.withResolvers<void>();
        messages.handle(message, () => mutation.promise);
        render(<ReviewQueue />, { wrapper });

        const actionButton = await screen.findByRole('button', { name: buttonName });
        const controls = screen.getAllByRole('button');
        for (const control of controls) expect(control).toBeEnabled();

        vi.mocked(sendMessage).mockClear();
        fireEvent.click(actionButton);
        for (const control of controls) fireEvent.click(control);
        fireEvent.click(actionButton);

        await waitFor(() => expect(sendMessage).toHaveBeenCalledTimes(1));
        expect(sendMessage).toHaveBeenCalledWith(message, expect.any(Object));
        for (const control of controls) expect(control).toBeDisabled();

        mutation.resolve();
        await waitFor(() => {
          for (const control of controls) expect(control).toBeEnabled();
        });
        expect(sendMessage).toHaveBeenCalledTimes(1);
      }
    );
  });
});
