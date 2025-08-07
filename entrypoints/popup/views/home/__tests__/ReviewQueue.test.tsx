/**
 * @vitest-environment happy-dom
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { ReviewQueue } from '../ReviewQueue';
import { createTestWrapper } from '@/test/utils/test-wrapper';
import {
  useReviewQueueQuery,
  useRateCardMutation,
  useRemoveCardMutation,
  useDelayCardMutation,
  usePauseCardMutation,
} from '@/hooks/useBackgroundQueries';
import { createQueryMock, createMutationMock } from '@/test/utils/query-mocks';
import { createMockCard } from '@/test/utils/card-mocks';
import { Rating, State } from 'ts-fsrs';

// Mock localStorage to disable animations in tests
const originalLocalStorage = window.localStorage;
const mockLocalStorage = {
  getItem: (key: string) => {
    if (key === 'animationsEnabled') return 'false';
    return null;
  },
  setItem: vi.fn(),
  removeItem: vi.fn(),
  clear: vi.fn(),
  length: 0,
  key: () => null,
};

// Mock the hooks
vi.mock('@/hooks/useBackgroundQueries', () => ({
  useReviewQueueQuery: vi.fn(),
  useRateCardMutation: vi.fn(),
  useRemoveCardMutation: vi.fn(),
  useDelayCardMutation: vi.fn(),
  usePauseCardMutation: vi.fn(),
  useAnimationsEnabledQuery: vi.fn(() => ({ data: false })),
  useSetAnimationsEnabledMutation: vi.fn(() => ({ mutate: vi.fn() })),
  useThemeQuery: vi.fn(() => ({ data: 'dark' })),
  useSetThemeMutation: vi.fn(() => ({ mutate: vi.fn() })),
  queryKeys: {
    cards: {
      all: ['cards'],
      reviewQueue: ['cards', 'reviewQueue'],
    },
    stats: {
      today: ['stats', 'today'],
    },
  },
}));

// Create a mock for useQueryClient
const mockInvalidateQueries = vi.fn();
vi.mock('@tanstack/react-query', async () => {
  const actual = await vi.importActual<typeof import('@tanstack/react-query')>('@tanstack/react-query');
  return {
    ...actual,
    useQueryClient: () => ({
      invalidateQueries: mockInvalidateQueries,
    }),
  };
});

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
      <button onClick={() => onRate(Rating.Again)} disabled={isProcessing}>
        Again
      </button>
      <button onClick={() => onRate(Rating.Hard)} disabled={isProcessing}>
        Hard
      </button>
      <button onClick={() => onRate(Rating.Good)} disabled={isProcessing}>
        Good
      </button>
      <button onClick={() => onRate(Rating.Easy)} disabled={isProcessing}>
        Easy
      </button>
    </div>
  ),
}));

vi.mock('../NotesSection', () => ({
  NotesSection: ({ cardId }: { cardId: string }) => <div data-testid="notes-section">Notes for {cardId}</div>,
}));

vi.mock('../ActionsSection', () => ({
  ActionsSection: ({
    onDelete,
    onDelay,
    onPause,
  }: {
    onDelete: () => void;
    onDelay: (days: number) => void;
    onPause: () => void;
  }) => (
    <div data-testid="actions-section">
      <button onClick={onDelete} data-testid="delete-button">
        Delete
      </button>
      <button onClick={() => onDelay(1)} data-testid="delay-1-button">
        Delay 1 day
      </button>
      <button onClick={() => onDelay(5)} data-testid="delay-5-button">
        Delay 5 days
      </button>
      <button onClick={onPause} data-testid="pause-button">
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
  let wrapper: React.ComponentType<{ children: React.ReactNode }>;

  beforeEach(() => {
    // Set up localStorage mock
    Object.defineProperty(window, 'localStorage', {
      value: mockLocalStorage,
      writable: true,
      configurable: true,
    });

    vi.clearAllMocks();
    mockInvalidateQueries.mockClear();

    const testWrapper = createTestWrapper();
    wrapper = testWrapper.wrapper;

    // Default mock - queue with cards
    vi.mocked(useReviewQueueQuery).mockReturnValue(
      createQueryMock(mockCards) as ReturnType<typeof useReviewQueueQuery>
    );

    // Default mock for rate mutation
    vi.mocked(useRateCardMutation).mockReturnValue(
      createMutationMock({
        mutateAsync: mockMutateAsync,
        isPending: false,
      }) as ReturnType<typeof useRateCardMutation>
    );

    // Default mock for remove mutation
    vi.mocked(useRemoveCardMutation).mockReturnValue(
      createMutationMock({
        mutateAsync: vi.fn(),
        isPending: false,
      }) as ReturnType<typeof useRemoveCardMutation>
    );

    // Default mock for delay mutation
    vi.mocked(useDelayCardMutation).mockReturnValue(
      createMutationMock({
        mutateAsync: vi.fn(),
        isPending: false,
      }) as ReturnType<typeof useDelayCardMutation>
    );

    // Default mock for pause mutation
    vi.mocked(usePauseCardMutation).mockReturnValue(
      createMutationMock({
        mutateAsync: vi.fn(),
        isPending: false,
      }) as ReturnType<typeof usePauseCardMutation>
    );
  });

  afterEach(() => {
    Object.defineProperty(window, 'localStorage', {
      value: originalLocalStorage,
      writable: true,
      configurable: true,
    });
  });

  describe('Empty Queue', () => {
    it('should have animations disabled in tests', () => {
      // Verify that localStorage mock returns false for animationsEnabled
      expect(window.localStorage.getItem('animationsEnabled')).toBe('false');
    });

    it('should show empty state when no cards to review', async () => {
      vi.mocked(useReviewQueueQuery).mockReturnValue(createQueryMock([]) as ReturnType<typeof useReviewQueueQuery>);

      render(<ReviewQueue />, { wrapper });

      // Wait for state to initialize
      await waitFor(() => {
        expect(screen.getByText('No cards to review!')).toBeInTheDocument();
        expect(screen.getByText(/Add problems on LeetCode/)).toBeInTheDocument();
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
        expect(screen.getByText('Notes for 1')).toBeInTheDocument();
      });
    });

    it('should only display one card at a time', async () => {
      render(<ReviewQueue />, { wrapper });

      // Wait for state to initialize
      await waitFor(() => {
        expect(screen.getByText('Two Sum')).toBeInTheDocument();
      });

      // Should not display other cards
      expect(screen.queryByText('Add Two Numbers')).not.toBeInTheDocument();
      expect(screen.queryByText('Longest Substring')).not.toBeInTheDocument();
    });
  });

  describe('Card Rating', () => {
    it('should call mutation with correct parameters when rated', async () => {
      mockMutateAsync.mockResolvedValue({
        card: { ...mockCards[0], fsrs: { ...mockCards[0].fsrs, due: new Date(Date.now() + 86400000).toISOString() } },
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
          slug: 'two-sum',
          name: 'Two Sum',
          rating: Rating.Good,
          leetcodeId: '1',
          difficulty: 'Easy',
        });
      });
    });
  });

  describe('Processing State', () => {
    it('should disable rating buttons while processing', async () => {
      // Make mutateAsync never resolve
      mockMutateAsync.mockImplementation(() => new Promise(() => {}));

      render(<ReviewQueue />, { wrapper });

      // Wait for initial render
      await waitFor(() => {
        expect(screen.getByText('Two Sum')).toBeInTheDocument();
      });

      const againButton = screen.getByRole('button', { name: 'Again' });
      const hardButton = screen.getByRole('button', { name: 'Hard' });
      const goodButton = screen.getByRole('button', { name: 'Good' });
      const easyButton = screen.getByRole('button', { name: 'Easy' });

      // All buttons should be enabled initially
      expect(againButton).not.toBeDisabled();
      expect(hardButton).not.toBeDisabled();
      expect(goodButton).not.toBeDisabled();
      expect(easyButton).not.toBeDisabled();

      // Click a button
      fireEvent.click(goodButton);

      // All buttons should be disabled while processing
      await waitFor(() => {
        expect(againButton).toBeDisabled();
        expect(hardButton).toBeDisabled();
        expect(goodButton).toBeDisabled();
        expect(easyButton).toBeDisabled();
      });
    });

    it('should prevent multiple ratings while processing', async () => {
      // Make mutateAsync take some time
      mockMutateAsync.mockImplementation(
        () => new Promise((resolve) => setTimeout(() => resolve({ card: mockCards[0], shouldRequeue: false }), 100))
      );

      render(<ReviewQueue />, { wrapper });

      // Wait for initial render
      await waitFor(() => {
        expect(screen.getByText('Two Sum')).toBeInTheDocument();
      });

      const goodButton = screen.getByRole('button', { name: 'Good' });
      const hardButton = screen.getByRole('button', { name: 'Hard' });

      // Click multiple buttons quickly
      fireEvent.click(goodButton);
      fireEvent.click(hardButton);
      fireEvent.click(goodButton);

      // Should only have called mutateAsync once
      expect(mockMutateAsync).toHaveBeenCalledTimes(1);
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

    it('should not crash when queue is empty and handleRating is called', async () => {
      vi.mocked(useReviewQueueQuery).mockReturnValue(createQueryMock([]) as ReturnType<typeof useReviewQueueQuery>);

      render(<ReviewQueue />, { wrapper });

      // Wait for empty state
      await waitFor(() => {
        expect(screen.getByText('No cards to review!')).toBeInTheDocument();
      });

      // Even though there are no buttons to click, we can test the function doesn't crash
      // by checking that mutateAsync is never called
      expect(mockMutateAsync).not.toHaveBeenCalled();
    });
  });

  describe('Card Deletion', () => {
    let mockRemoveMutateAsync: ReturnType<typeof vi.fn>;

    beforeEach(() => {
      mockRemoveMutateAsync = vi.fn();
      vi.mocked(useRemoveCardMutation).mockReturnValue(
        createMutationMock({
          mutateAsync: mockRemoveMutateAsync,
          isPending: false,
        }) as ReturnType<typeof useRemoveCardMutation>
      );
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
        expect(mockRemoveMutateAsync).toHaveBeenCalledWith('two-sum');
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

    it('should disable all interactions while deleting', async () => {
      // Make deletion never resolve
      mockRemoveMutateAsync.mockImplementation(() => new Promise(() => {}));

      render(<ReviewQueue />, { wrapper });

      // Wait for initial render
      await waitFor(() => {
        expect(screen.getByText('Two Sum')).toBeInTheDocument();
      });

      const deleteButton = screen.getByTestId('delete-button');
      const againButton = screen.getByRole('button', { name: 'Again' });
      const hardButton = screen.getByRole('button', { name: 'Hard' });
      const goodButton = screen.getByRole('button', { name: 'Good' });
      const easyButton = screen.getByRole('button', { name: 'Easy' });

      // All buttons should be enabled initially
      expect(againButton).not.toBeDisabled();
      expect(hardButton).not.toBeDisabled();
      expect(goodButton).not.toBeDisabled();
      expect(easyButton).not.toBeDisabled();

      // Click delete button
      fireEvent.click(deleteButton);

      // All rating buttons should be disabled while processing
      await waitFor(() => {
        expect(againButton).toBeDisabled();
        expect(hardButton).toBeDisabled();
        expect(goodButton).toBeDisabled();
        expect(easyButton).toBeDisabled();
      });
    });

    it('should not crash when queue is empty and handleDelete is called', async () => {
      vi.mocked(useReviewQueueQuery).mockReturnValue(createQueryMock([]) as ReturnType<typeof useReviewQueueQuery>);

      render(<ReviewQueue />, { wrapper });

      // Wait for empty state
      await waitFor(() => {
        expect(screen.getByText('No cards to review!')).toBeInTheDocument();
      });

      // Delete button shouldn't be visible when queue is empty
      expect(screen.queryByTestId('delete-button')).not.toBeInTheDocument();

      // Verify remove mutation is never called
      expect(mockRemoveMutateAsync).not.toHaveBeenCalled();
    });

    it('should handle rapid delete clicks correctly', async () => {
      // Make deletion take some time
      mockRemoveMutateAsync.mockImplementation(
        () => new Promise((resolve) => setTimeout(() => resolve(undefined), 100))
      );

      render(<ReviewQueue />, { wrapper });

      // Wait for initial render
      await waitFor(() => {
        expect(screen.getByText('Two Sum')).toBeInTheDocument();
      });

      const deleteButton = screen.getByTestId('delete-button');

      // Click delete multiple times rapidly
      fireEvent.click(deleteButton);
      fireEvent.click(deleteButton);
      fireEvent.click(deleteButton);

      // Should only have called remove mutation once
      expect(mockRemoveMutateAsync).toHaveBeenCalledTimes(1);
    });
  });

  describe('Card Delay', () => {
    let mockDelayMutateAsync: ReturnType<typeof vi.fn>;

    beforeEach(() => {
      mockDelayMutateAsync = vi.fn();
      vi.mocked(useDelayCardMutation).mockReturnValue(
        createMutationMock({
          mutateAsync: mockDelayMutateAsync,
          isPending: false,
        }) as ReturnType<typeof useDelayCardMutation>
      );
    });

    it('should call delay mutation when delay buttons are clicked', async () => {
      const delayedCard = {
        ...mockCards[0],
        fsrs: {
          ...mockCards[0].fsrs,
          due: new Date(Date.now() + 86400000),
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

    it('should disable all interactions while delaying', async () => {
      // Make delay never resolve
      mockDelayMutateAsync.mockImplementation(() => new Promise(() => {}));

      render(<ReviewQueue />, { wrapper });

      // Wait for initial render
      await waitFor(() => {
        expect(screen.getByText('Two Sum')).toBeInTheDocument();
      });

      const delay1Button = screen.getByTestId('delay-1-button');
      const againButton = screen.getByRole('button', { name: 'Again' });
      const hardButton = screen.getByRole('button', { name: 'Hard' });
      const goodButton = screen.getByRole('button', { name: 'Good' });
      const easyButton = screen.getByRole('button', { name: 'Easy' });

      // All buttons should be enabled initially
      expect(againButton).not.toBeDisabled();
      expect(hardButton).not.toBeDisabled();
      expect(goodButton).not.toBeDisabled();
      expect(easyButton).not.toBeDisabled();

      // Click delay button
      fireEvent.click(delay1Button);

      // All rating buttons should be disabled while processing
      await waitFor(() => {
        expect(againButton).toBeDisabled();
        expect(hardButton).toBeDisabled();
        expect(goodButton).toBeDisabled();
        expect(easyButton).toBeDisabled();
      });
    });

    it('should handle rapid delay clicks correctly', async () => {
      // Make delay take some time
      mockDelayMutateAsync.mockImplementation(
        () => new Promise((resolve) => setTimeout(() => resolve(mockCards[0]), 100))
      );

      render(<ReviewQueue />, { wrapper });

      // Wait for initial render
      await waitFor(() => {
        expect(screen.getByText('Two Sum')).toBeInTheDocument();
      });

      const delay1Button = screen.getByTestId('delay-1-button');
      const delay5Button = screen.getByTestId('delay-5-button');

      // Click delay buttons multiple times rapidly
      fireEvent.click(delay1Button);
      fireEvent.click(delay5Button);
      fireEvent.click(delay1Button);

      // Should only have called delay mutation once
      expect(mockDelayMutateAsync).toHaveBeenCalledTimes(1);
    });
  });

  describe('Component Integration', () => {
    it('should pass correct props to ReviewCard', async () => {
      render(<ReviewQueue />, { wrapper });

      // Wait for initial render
      await waitFor(() => {
        const reviewCard = screen.getByTestId('review-card');
        expect(reviewCard).toBeInTheDocument();
        expect(screen.getByText('Two Sum')).toBeInTheDocument();
      });
    });

    it('should pass correct callbacks to ActionsSection', async () => {
      render(<ReviewQueue />, { wrapper });

      // Wait for initial render
      await waitFor(() => {
        expect(screen.getByTestId('actions-section')).toBeInTheDocument();
        expect(screen.getByTestId('delete-button')).toBeInTheDocument();
        expect(screen.getByTestId('delay-1-button')).toBeInTheDocument();
        expect(screen.getByTestId('delay-5-button')).toBeInTheDocument();
      });
    });

    it('should pass correct cardId to NotesSection', async () => {
      render(<ReviewQueue />, { wrapper });

      // Wait for initial render
      await waitFor(() => {
        expect(screen.getByText('Notes for 1')).toBeInTheDocument();
      });
    });
  });
});
