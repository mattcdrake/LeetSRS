/**
 * @vitest-environment happy-dom
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { StatsBar } from '../StatsBar';
import { useReviewQueueQuery } from '@/hooks/useBackgroundQueries';
import { State } from 'ts-fsrs';
import type { Card } from '@/shared/cards';
import { createTestWrapper } from '@/test/utils/test-wrapper';
import { createMockCard } from '@/test/utils/card-mocks';
import { createQueryMock } from '@/test/utils/query-mocks';

// Mock the useReviewQueueQuery hook
vi.mock('@/hooks/useBackgroundQueries', () => ({
  useReviewQueueQuery: vi.fn(),
  useAnimationsEnabledQuery: vi.fn(() => ({ data: false })),
  useSetAnimationsEnabledMutation: vi.fn(() => ({ mutate: vi.fn() })),
  useThemeQuery: vi.fn(() => ({ data: 'dark' })),
  useSetThemeMutation: vi.fn(() => ({ mutate: vi.fn() })),
}));

describe('StatsBar', () => {
  const { wrapper: TestWrapper } = createTestWrapper();

  const renderWithProviders = () => {
    return render(<StatsBar />, { wrapper: TestWrapper });
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Rendering', () => {
    it('should render all three stat categories', () => {
      vi.mocked(useReviewQueueQuery).mockReturnValue(
        createQueryMock<Card[]>([]) as ReturnType<typeof useReviewQueueQuery>
      );

      renderWithProviders();

      expect(screen.getByTestId('stat-review')).toBeInTheDocument();
      expect(screen.getByTestId('stat-new')).toBeInTheDocument();
      expect(screen.getByTestId('stat-learn')).toBeInTheDocument();
    });

    it('should display zero counts when no cards', () => {
      vi.mocked(useReviewQueueQuery).mockReturnValue(
        createQueryMock<Card[]>([]) as ReturnType<typeof useReviewQueueQuery>
      );

      renderWithProviders();

      expect(screen.getByTestId('stat-review-count')).toHaveTextContent('0');
      expect(screen.getByTestId('stat-new-count')).toHaveTextContent('0');
      expect(screen.getByTestId('stat-learn-count')).toHaveTextContent('0');
    });

    it('should display zero counts when data is undefined', () => {
      vi.mocked(useReviewQueueQuery).mockReturnValue(
        createQueryMock<Card[] | undefined>(undefined) as ReturnType<typeof useReviewQueueQuery>
      );

      renderWithProviders();

      expect(screen.getByTestId('stat-review-count')).toHaveTextContent('0');
      expect(screen.getByTestId('stat-new-count')).toHaveTextContent('0');
      expect(screen.getByTestId('stat-learn-count')).toHaveTextContent('0');
    });
  });

  describe('State Counting', () => {
    it('should count Review state cards correctly', () => {
      const mockCards = [
        createMockCard(State.Review),
        createMockCard(State.Review),
        createMockCard(State.Review),
        createMockCard(State.New),
        createMockCard(State.Learning),
      ];

      vi.mocked(useReviewQueueQuery).mockReturnValue(
        createQueryMock(mockCards) as ReturnType<typeof useReviewQueueQuery>
      );

      renderWithProviders();

      expect(screen.getByTestId('stat-review-count')).toHaveTextContent('3');
    });

    it('should count New state cards correctly', () => {
      const mockCards = [
        createMockCard(State.New),
        createMockCard(State.New),
        createMockCard(State.Review),
        createMockCard(State.Learning),
      ];

      vi.mocked(useReviewQueueQuery).mockReturnValue(
        createQueryMock(mockCards) as ReturnType<typeof useReviewQueueQuery>
      );

      renderWithProviders();

      expect(screen.getByTestId('stat-new-count')).toHaveTextContent('2');
    });

    it('should count Learning state cards correctly', () => {
      const mockCards = [
        createMockCard(State.Learning),
        createMockCard(State.Learning),
        createMockCard(State.Learning),
        createMockCard(State.New),
        createMockCard(State.Review),
      ];

      vi.mocked(useReviewQueueQuery).mockReturnValue(
        createQueryMock(mockCards) as ReturnType<typeof useReviewQueueQuery>
      );

      renderWithProviders();

      expect(screen.getByTestId('stat-learn-count')).toHaveTextContent('3');
    });

    it('should count Relearning state cards correctly', () => {
      const mockCards = [
        createMockCard(State.Relearning),
        createMockCard(State.Relearning),
        createMockCard(State.New),
        createMockCard(State.Review),
      ];

      vi.mocked(useReviewQueueQuery).mockReturnValue(
        createQueryMock(mockCards) as ReturnType<typeof useReviewQueueQuery>
      );

      renderWithProviders();

      expect(screen.getByTestId('stat-learn-count')).toHaveTextContent('2');
    });

    it('should count mixed Learning and Relearning states together', () => {
      const mockCards = [
        createMockCard(State.Learning),
        createMockCard(State.Relearning),
        createMockCard(State.Learning),
        createMockCard(State.Relearning),
        createMockCard(State.New),
      ];

      vi.mocked(useReviewQueueQuery).mockReturnValue(
        createQueryMock(mockCards) as ReturnType<typeof useReviewQueueQuery>
      );

      renderWithProviders();

      expect(screen.getByTestId('stat-learn-count')).toHaveTextContent('4');
    });

    it('should handle all states correctly in one dataset', () => {
      const mockCards = [
        // 5 Review
        createMockCard(State.Review),
        createMockCard(State.Review),
        createMockCard(State.Review),
        createMockCard(State.Review),
        createMockCard(State.Review),
        // 3 New
        createMockCard(State.New),
        createMockCard(State.New),
        createMockCard(State.New),
        // 2 Learning + 1 Relearning = 3 learn
        createMockCard(State.Learning),
        createMockCard(State.Learning),
        createMockCard(State.Relearning),
      ];

      vi.mocked(useReviewQueueQuery).mockReturnValue(
        createQueryMock(mockCards) as ReturnType<typeof useReviewQueueQuery>
      );

      renderWithProviders();

      expect(screen.getByTestId('stat-review-count')).toHaveTextContent('5');
      expect(screen.getByTestId('stat-new-count')).toHaveTextContent('3');
      expect(screen.getByTestId('stat-learn-count')).toHaveTextContent('3');
    });

    it('should ignore cards with unknown states', () => {
      const baseCard = createMockCard(State.New);

      // Create cards with invalid states for testing edge cases
      const cardWithInvalidState = {
        ...baseCard,
        fsrs: { ...baseCard.fsrs, state: 999 as State },
      };

      const mockCards: Card[] = [
        createMockCard(State.Review),
        createMockCard(State.New),
        createMockCard(State.Learning),
        // This card has an invalid state value that should be ignored
        cardWithInvalidState,
      ];

      vi.mocked(useReviewQueueQuery).mockReturnValue(
        createQueryMock(mockCards) as ReturnType<typeof useReviewQueueQuery>
      );

      renderWithProviders();

      // Should only count the valid states
      expect(screen.getByTestId('stat-review-count')).toHaveTextContent('1');
      expect(screen.getByTestId('stat-new-count')).toHaveTextContent('1');
      expect(screen.getByTestId('stat-learn-count')).toHaveTextContent('1');
    });
  });

  describe('Edge Cases', () => {
    it('should handle empty array gracefully', () => {
      vi.mocked(useReviewQueueQuery).mockReturnValue(
        createQueryMock<Card[]>([]) as ReturnType<typeof useReviewQueueQuery>
      );

      renderWithProviders();

      expect(screen.getByTestId('stat-review-count')).toHaveTextContent('0');
      expect(screen.getByTestId('stat-new-count')).toHaveTextContent('0');
      expect(screen.getByTestId('stat-learn-count')).toHaveTextContent('0');
    });

    it('should handle large numbers correctly', () => {
      const mockCards = Array(999)
        .fill(null)
        .map(() => createMockCard(State.Review));

      vi.mocked(useReviewQueueQuery).mockReturnValue(
        createQueryMock(mockCards) as ReturnType<typeof useReviewQueueQuery>
      );

      renderWithProviders();

      expect(screen.getByTestId('stat-review-count')).toHaveTextContent('999');
    });
  });
});
