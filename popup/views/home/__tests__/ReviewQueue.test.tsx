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
  NotesSection: ({ slug }: { slug: string }) => <div data-testid="notes-section">Notes for {slug}</div>,
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
      .resolve('delayCard', mockCards[0])
      .resolve('setPauseStatus', mockCards[0]);
    mockMutateAsync.mockReset();

    ({ wrapper, queryClient } = createTestWrapper());
    mockCards.forEach((card, index) => {
      card.fsrs.due = index;
    });
    seedQueue(mockCards);
    mockMutateAsync.mockResolvedValue({ card: mockCards[0], shouldRequeue: false });
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
      mockMutateAsync.mockResolvedValue({
        card: { ...mockCards[0], fsrs: { ...mockCards[0].fsrs, due: Date.now() + 86400000 } },
        shouldRequeue: false,
      });

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
    it.each([
      [false, 'animate-slide-right'],
      [true, 'animate-slide-left'],
    ] as const)(
      'should finish processing after rating with shouldRequeue=%s',
      async (shouldRequeue, animationClass) => {
        mockMutateAsync.mockResolvedValue({ card: mockCards[0], shouldRequeue });
        render(<ReviewQueue />, { wrapper });

        const goodButton = await screen.findByRole('button', { name: 'Good' });
        fireEvent.click(goodButton);

        const cardContainer = screen.getByTestId('review-card').parentElement;
        await waitFor(() => expect(cardContainer).toHaveClass(animationClass));
        expect(goodButton).toBeDisabled();

        fireEvent.animationEnd(cardContainer as HTMLElement);

        await waitFor(() => expect(goodButton).not.toBeDisabled());
        expect(cardContainer).not.toHaveClass(animationClass);
      }
    );

    it('should retain the outgoing card and disabled actions until the animation ends', async () => {
      const mutation = Promise.withResolvers<{ card: Card; shouldRequeue: boolean }>();
      mockMutateAsync.mockReturnValue(mutation.promise);
      render(<ReviewQueue />, { wrapper });

      fireEvent.click(await screen.findByRole('button', { name: 'Good' }));
      const cardContainer = screen.getByTestId('review-card').parentElement as HTMLElement;
      await act(async () => seedQueue(mockCards.slice(1)));
      fireEvent.animationEnd(cardContainer);
      expect(screen.getByRole('button', { name: 'Good' })).toBeDisabled();

      mutation.resolve({ card: mockCards[0], shouldRequeue: false });
      await waitFor(() => expect(cardContainer).toHaveClass('animate-slide-right'));
      fireEvent.animationEnd(screen.getByTestId('review-card'));

      expect(screen.getByText('Two Sum')).toBeInTheDocument();
      expect(screen.queryByText('Add Two Numbers')).not.toBeInTheDocument();
      expect(screen.getByTestId('delete-button')).toBeDisabled();
      expect(screen.getByTestId('delay-1-button')).toBeDisabled();
      expect(screen.getByTestId('pause-button')).toBeDisabled();

      fireEvent.animationEnd(cardContainer);

      await waitFor(() => expect(screen.getByText('Add Two Numbers')).toBeInTheDocument());
      expect(screen.getByTestId('delete-button')).not.toBeDisabled();
    });

    it('should advance after saving without waiting for animation when motion is reduced', async () => {
      vi.spyOn(window, 'matchMedia').mockReturnValue({
        ...window.matchMedia('(prefers-reduced-motion: reduce)'),
        matches: true,
      });
      const mutation = Promise.withResolvers<{ card: Card; shouldRequeue: boolean }>();
      mockMutateAsync.mockReturnValue(mutation.promise);
      render(<ReviewQueue />, { wrapper });

      fireEvent.click(await screen.findByRole('button', { name: 'Good' }));
      await act(async () => seedQueue(mockCards.slice(1)));
      expect(screen.getByText('Two Sum')).toBeInTheDocument();
      expect(screen.getByTestId('pause-button')).toBeDisabled();

      mutation.resolve({ card: mockCards[0], shouldRequeue: false });

      await waitFor(() => expect(screen.getByText('Add Two Numbers')).toBeInTheDocument());
      expect(screen.getByRole('button', { name: 'Good' })).not.toBeDisabled();
      expect(screen.getByTestId('pause-button')).not.toBeDisabled();
      expect(screen.getByTestId('review-card').parentElement).toHaveClass('animate-slide-in');
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
    let mockDelayMutateAsync: Mock<(data: { slug: string; days: number }) => Promise<Card>>;

    beforeEach(() => {
      vi.spyOn(storage, 'getItem');
      mockDelayMutateAsync = vi.fn();
      messages.handle('delayCard', mockDelayMutateAsync);
    });

    it('should call delay mutation when delay buttons are clicked', async () => {
      const delayedCard = {
        ...mockCards[0],
        fsrs: {
          ...mockCards[0].fsrs,
          due: new Date(Date.now() + 86400000).getTime(),
        },
      };
      mockDelayMutateAsync.mockResolvedValue(delayedCard);

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
      ['Good', 'rateCard', { card: mockCards[0], shouldRequeue: false }, 'animate-slide-right'],
      ['Delete', 'removeCard', undefined, 'animate-slide-left'],
      ['Delay 1 day', 'delayCard', mockCards[0], 'animate-slide-right'],
      ['Pause', 'setPauseStatus', mockCards[0], 'animate-slide-right'],
    ] as const)(
      'should disable controls and prevent duplicate actions while %s is pending',
      async (buttonName, message, result, animationClass) => {
        const mutation = Promise.withResolvers<typeof result>();
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

        mutation.resolve(result);
        const cardContainer = screen.getByTestId('review-card').parentElement as HTMLElement;
        await waitFor(() => expect(cardContainer).toHaveClass(animationClass));
        for (const control of controls) expect(control).toBeDisabled();

        fireEvent.animationEnd(cardContainer);
        await waitFor(() => {
          for (const control of controls) expect(control).toBeEnabled();
        });
        expect(cardContainer).not.toHaveClass(animationClass);
        expect(sendMessage).toHaveBeenCalledTimes(1);
      }
    );
  });
});
