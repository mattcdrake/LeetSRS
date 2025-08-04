/**
 * @vitest-environment happy-dom
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { ReviewCard } from '../ReviewCard';
import { useRateCardMutation } from '@/hooks/useBackgroundQueries';
import { Rating } from 'ts-fsrs';
import type { Card } from '@/types';
import { createMutationMock } from '@/test/utils/query-mocks';
import { createTestWrapper } from '@/test/utils/test-wrapper';

// Mock the useRateCardMutation hook
vi.mock('@/hooks/useBackgroundQueries', () => ({
  useRateCardMutation: vi.fn(),
}));

describe('ReviewCard', () => {
  const mockMutate = vi.fn();
  const mockCard: Pick<Card, 'slug' | 'leetcodeId' | 'name' | 'difficulty'> = {
    slug: 'two-sum',
    leetcodeId: '1',
    name: 'Two Sum',
    difficulty: 'Easy',
  };

  const { wrapper: TestWrapper } = createTestWrapper();

  const renderWithProviders = (card = mockCard) => {
    return render(<ReviewCard card={card} />, { wrapper: TestWrapper });
  };

  beforeEach(() => {
    vi.clearAllMocks();
    // Use the factory function with just the properties we care about
    vi.mocked(useRateCardMutation).mockReturnValue(
      createMutationMock({
        mutate: mockMutate,
      }) as ReturnType<typeof useRateCardMutation>
    );
  });

  describe('Rendering', () => {
    it('should render the problem ID', () => {
      renderWithProviders();
      expect(screen.getByText('#1')).toBeInTheDocument();
    });

    it('should render the problem name', () => {
      renderWithProviders();
      expect(screen.getByText('Two Sum')).toBeInTheDocument();
    });

    it('should render the difficulty badge with correct color class', () => {
      renderWithProviders();
      // Use getAllByText since there's a difficulty badge and a rating button both with "Easy"
      const elements = screen.getAllByText('Easy');
      // The first one should be the difficulty badge (appears before buttons in DOM)
      const difficultyBadge = elements[0];
      expect(difficultyBadge).toHaveClass('bg-difficulty-easy');
    });

    it('should render correct difficulty colors for each level', () => {
      const { rerender } = renderWithProviders();

      // Test Easy - get the first one which is the difficulty badge
      const easyElements = screen.getAllByText('Easy');
      expect(easyElements[0]).toHaveClass('bg-difficulty-easy');

      // Test Medium
      rerender(<ReviewCard card={{ ...mockCard, difficulty: 'Medium' }} />);
      expect(screen.getByText('Medium')).toHaveClass('bg-difficulty-medium');

      // Test Hard
      rerender(<ReviewCard card={{ ...mockCard, difficulty: 'Hard' }} />);
      // Also need to handle Hard button collision
      const hardElements = screen.getAllByText('Hard');
      expect(hardElements[0]).toHaveClass('bg-difficulty-hard');
    });

    it('should render the external link to LeetCode problem', () => {
      renderWithProviders();
      const link = screen.getByRole('link', { name: /Two Sum/i });
      expect(link).toHaveAttribute('href', 'https://leetcode.com/problems/two-sum/description/');
      expect(link).toHaveAttribute('target', '_blank');
      expect(link).toHaveAttribute('rel', 'noopener noreferrer');
    });

    it('should render all four rating buttons', () => {
      renderWithProviders();
      expect(screen.getByRole('button', { name: 'Again' })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Hard' })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Good' })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Easy' })).toBeInTheDocument();
    });

    it('should apply correct color classes to rating buttons', () => {
      renderWithProviders();
      expect(screen.getByRole('button', { name: 'Again' })).toHaveClass('bg-rating-again');
      expect(screen.getByRole('button', { name: 'Hard' })).toHaveClass('bg-rating-hard');
      expect(screen.getByRole('button', { name: 'Good' })).toHaveClass('bg-rating-good');
      expect(screen.getByRole('button', { name: 'Easy' })).toHaveClass('bg-rating-easy');
    });
  });

  describe('Interactions', () => {
    it('should call mutate with correct data when Again button is clicked', async () => {
      renderWithProviders();
      const againButton = screen.getByRole('button', { name: 'Again' });

      fireEvent.click(againButton);

      await waitFor(() => {
        expect(mockMutate).toHaveBeenCalledWith({
          slug: 'two-sum',
          name: 'Two Sum',
          rating: Rating.Again,
          leetcodeId: '1',
          difficulty: 'Easy',
        });
      });
    });

    it('should call mutate with correct data when Hard button is clicked', async () => {
      renderWithProviders();
      const hardButton = screen.getByRole('button', { name: 'Hard' });

      fireEvent.click(hardButton);

      await waitFor(() => {
        expect(mockMutate).toHaveBeenCalledWith({
          slug: 'two-sum',
          name: 'Two Sum',
          rating: Rating.Hard,
          leetcodeId: '1',
          difficulty: 'Easy',
        });
      });
    });

    it('should call mutate with correct data when Good button is clicked', async () => {
      renderWithProviders();
      const goodButton = screen.getByRole('button', { name: 'Good' });

      fireEvent.click(goodButton);

      await waitFor(() => {
        expect(mockMutate).toHaveBeenCalledWith({
          slug: 'two-sum',
          name: 'Two Sum',
          rating: Rating.Good,
          leetcodeId: '1',
          difficulty: 'Easy',
        });
      });
    });

    it('should call mutate with correct data when Easy button is clicked', async () => {
      renderWithProviders();
      const easyButton = screen.getByRole('button', { name: 'Easy' });

      fireEvent.click(easyButton);

      await waitFor(() => {
        expect(mockMutate).toHaveBeenCalledWith({
          slug: 'two-sum',
          name: 'Two Sum',
          rating: Rating.Easy,
          leetcodeId: '1',
          difficulty: 'Easy',
        });
      });
    });

    it('should only call mutate once per button click', async () => {
      renderWithProviders();
      const goodButton = screen.getByRole('button', { name: 'Good' });

      fireEvent.click(goodButton);

      await waitFor(() => {
        expect(mockMutate).toHaveBeenCalledTimes(1);
      });
    });
  });

  describe('Styling', () => {
    it('should have cursor pointer on rating buttons', () => {
      renderWithProviders();
      const buttons = screen.getAllByRole('button');

      buttons.forEach((button) => {
        expect(button).toHaveClass('cursor-pointer');
      });
    });

    it('should have consistent button width', () => {
      renderWithProviders();
      const buttons = screen.getAllByRole('button');

      buttons.forEach((button) => {
        expect(button).toHaveClass('w-16');
      });
    });
  });

  describe('Edge Cases', () => {
    it('should handle cards with long names gracefully', () => {
      const longNameCard = {
        ...mockCard,
        name: 'This is a very long problem name that might overflow the card boundaries',
      };
      renderWithProviders(longNameCard);

      expect(screen.getByText(longNameCard.name)).toBeInTheDocument();
    });

    it('should handle cards with special characters in slug', () => {
      const specialCard = {
        ...mockCard,
        slug: 'problem-with-special_chars-123',
      };
      renderWithProviders(specialCard);

      const link = screen.getByRole('link');
      expect(link).toHaveAttribute('href', 'https://leetcode.com/problems/problem-with-special_chars-123/description/');
    });
  });

  describe('Accessibility', () => {
    it('should have accessible button labels', () => {
      renderWithProviders();

      expect(screen.getByRole('button', { name: 'Again' })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Hard' })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Good' })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Easy' })).toBeInTheDocument();
    });

    it('should have accessible link with proper attributes', () => {
      renderWithProviders();
      const link = screen.getByRole('link');

      expect(link).toHaveAttribute('target', '_blank');
      expect(link).toHaveAttribute('rel', 'noopener noreferrer');
    });
  });
});
