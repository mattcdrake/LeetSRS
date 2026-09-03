/**
 * @vitest-environment happy-dom
 */

import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { Rating } from 'ts-fsrs';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Card } from '@/shared/cards';
import { createTestWrapper } from '@/test/utils/test-wrapper';
import { ReviewCard } from '../ReviewCard';

// No longer need to mock useRateCardMutation since we're using onRate prop

describe('ReviewCard', () => {
  const mockOnRate = vi.fn();
  const mockCard: Pick<Card, 'slug' | 'leetcodeId' | 'name' | 'difficulty' | 'domain'> = {
    slug: 'two-sum',
    leetcodeId: '1',
    name: 'Two Sum',
    difficulty: 'Easy',
    domain: 'leetcode.com',
  };

  const { wrapper: TestWrapper } = createTestWrapper();

  const renderWithProviders = (card = mockCard, onRate = mockOnRate) => {
    return render(<ReviewCard card={card} onRate={onRate} />, { wrapper: TestWrapper });
  };

  beforeEach(() => {
    vi.clearAllMocks();
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

    it.each([
      ['Easy', 'bg-difficulty-easy'],
      ['Medium', 'bg-difficulty-medium'],
      ['Hard', 'bg-difficulty-hard'],
    ] as const)('should render the %s difficulty with the correct color', (difficulty, colorClass) => {
      renderWithProviders({ ...mockCard, difficulty });
      expect(screen.getAllByText(difficulty)[0]).toHaveClass(colorClass);
    });

    it('should render the external link to LeetCode problem', () => {
      renderWithProviders();
      const link = screen.getByRole('link', { name: /LeetCode/i });
      expect(link).toHaveAttribute('href', 'https://leetcode.com/problems/two-sum/description/');
      expect(link).toHaveAttribute('target', '_blank');
      expect(link).toHaveAttribute('rel', 'noopener noreferrer');
    });

    it.each([
      ['Again', 'bg-rating-again'],
      ['Hard', 'bg-rating-hard'],
      ['Good', 'bg-rating-good'],
      ['Easy', 'bg-rating-easy'],
    ] as const)('should render the %s rating button with the correct color', (label, colorClass) => {
      renderWithProviders();
      expect(screen.getByRole('button', { name: label })).toHaveClass(colorClass);
    });
  });

  describe('Interactions', () => {
    it.each([
      ['Again', Rating.Again],
      ['Hard', Rating.Hard],
      ['Good', Rating.Good],
      ['Easy', Rating.Easy],
    ] as const)('should call onRate with the %s rating', async (label, rating) => {
      renderWithProviders();
      fireEvent.click(screen.getByRole('button', { name: label }));

      await waitFor(() => {
        expect(mockOnRate).toHaveBeenCalledWith(rating);
      });
    });

    it('should only call onRate once per button click', async () => {
      renderWithProviders();
      const goodButton = screen.getByRole('button', { name: 'Good' });

      fireEvent.click(goodButton);

      await waitFor(() => {
        expect(mockOnRate).toHaveBeenCalledTimes(1);
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
        expect(button).toHaveClass('w-20');
      });
    });
  });

  describe('Edge Cases', () => {
    it('should handle cards with special characters in slug', () => {
      const specialCard = {
        ...mockCard,
        slug: 'problem-with-special_chars-123',
      };
      renderWithProviders(specialCard);

      const link = screen.getByRole('link', { name: /LeetCode/i });
      expect(link).toHaveAttribute('href', 'https://leetcode.com/problems/problem-with-special_chars-123/description/');
    });
  });
});
