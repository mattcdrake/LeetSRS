/**
 * @vitest-environment happy-dom
 */
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { StreakCounter } from '../StreakCounter';
import { createTestWrapper } from '@/test/utils/test-wrapper';
import { createQueryMock } from '@/test/utils/query-mocks';
import { useTodayStatsQuery } from '@/hooks/useBackgroundQueries';
import type { UseQueryResult } from '@tanstack/react-query';
import type { DailyStats } from '@/services/stats';
import { Rating } from 'ts-fsrs';

// Mock the query hook
vi.mock('@/hooks/useBackgroundQueries', () => ({
  useTodayStatsQuery: vi.fn(),
}));

describe('StreakCounter', () => {
  const { wrapper } = createTestWrapper();

  const renderStreakCounter = () => {
    return render(<StreakCounter />, { wrapper });
  };

  it('should not render when streak is 0', () => {
    const mockStats: DailyStats = {
      date: '2024-03-15',
      totalReviews: 0,
      gradeBreakdown: {
        [Rating.Again]: 0,
        [Rating.Hard]: 0,
        [Rating.Good]: 0,
        [Rating.Easy]: 0,
      },
      newCards: 0,
      reviewedCards: 0,
      streak: 0,
    };

    vi.mocked(useTodayStatsQuery).mockReturnValue(createQueryMock(mockStats) as UseQueryResult<DailyStats | null>);

    const { container } = renderStreakCounter();
    expect(container.firstChild).toBeNull();
  });

  it('should not render when todayStats is null', () => {
    vi.mocked(useTodayStatsQuery).mockReturnValue(createQueryMock(null) as UseQueryResult<DailyStats | null>);

    const { container } = renderStreakCounter();
    expect(container.firstChild).toBeNull();
  });

  it('should render streak when greater than 0', () => {
    const mockStats: DailyStats = {
      date: '2024-03-15',
      totalReviews: 5,
      gradeBreakdown: {
        [Rating.Again]: 1,
        [Rating.Hard]: 1,
        [Rating.Good]: 2,
        [Rating.Easy]: 1,
      },
      newCards: 2,
      reviewedCards: 3,
      streak: 5,
    };

    vi.mocked(useTodayStatsQuery).mockReturnValue(createQueryMock(mockStats) as UseQueryResult<DailyStats | null>);

    renderStreakCounter();

    expect(screen.getByText('5')).toBeInTheDocument();
  });

  it('should render fire icon', () => {
    const mockStats: DailyStats = {
      date: '2024-03-15',
      totalReviews: 10,
      gradeBreakdown: {
        [Rating.Again]: 2,
        [Rating.Hard]: 2,
        [Rating.Good]: 4,
        [Rating.Easy]: 2,
      },
      newCards: 3,
      reviewedCards: 7,
      streak: 10,
    };

    vi.mocked(useTodayStatsQuery).mockReturnValue(createQueryMock(mockStats) as UseQueryResult<DailyStats | null>);

    const { container } = renderStreakCounter();

    // Check for fire icon by class
    const fireIcon = container.querySelector('svg');
    expect(fireIcon).toBeInTheDocument();
    expect(fireIcon).toHaveClass('text-orange-500');
  });

  it('should display large streak numbers correctly', () => {
    const mockStats: DailyStats = {
      date: '2024-03-15',
      totalReviews: 100,
      gradeBreakdown: {
        [Rating.Again]: 10,
        [Rating.Hard]: 20,
        [Rating.Good]: 50,
        [Rating.Easy]: 20,
      },
      newCards: 10,
      reviewedCards: 90,
      streak: 365,
    };

    vi.mocked(useTodayStatsQuery).mockReturnValue(createQueryMock(mockStats) as UseQueryResult<DailyStats | null>);

    renderStreakCounter();

    expect(screen.getByText('365')).toBeInTheDocument();
  });

  it('should apply correct styling classes', () => {
    const mockStats: DailyStats = {
      date: '2024-03-15',
      totalReviews: 5,
      gradeBreakdown: {
        [Rating.Again]: 1,
        [Rating.Hard]: 1,
        [Rating.Good]: 2,
        [Rating.Easy]: 1,
      },
      newCards: 2,
      reviewedCards: 3,
      streak: 7,
    };

    vi.mocked(useTodayStatsQuery).mockReturnValue(createQueryMock(mockStats) as UseQueryResult<DailyStats | null>);

    const { container } = renderStreakCounter();

    const streakContainer = container.firstChild as HTMLElement;
    expect(streakContainer).toHaveClass('flex', 'items-center', 'gap-1', 'text-sm', 'font-medium', 'text-primary');
  });

  it('should handle loading state gracefully', () => {
    vi.mocked(useTodayStatsQuery).mockReturnValue(
      createQueryMock<DailyStats | null>(null, {
        isLoading: true,
        isPending: true,
        isSuccess: false,
        isFetching: true,
        isFetched: false,
        status: 'pending',
        fetchStatus: 'fetching',
        dataUpdatedAt: 0,
      }) as UseQueryResult<DailyStats | null>
    );

    const { container } = renderStreakCounter();
    expect(container.firstChild).toBeNull();
  });

  it('should handle error state gracefully', () => {
    const error = new Error('Failed to fetch stats');
    vi.mocked(useTodayStatsQuery).mockReturnValue(
      createQueryMock<DailyStats | null>(null, {
        error,
        isError: true,
        isSuccess: false,
        isLoadingError: true,
        status: 'error',
        errorUpdatedAt: Date.now(),
        dataUpdatedAt: 0,
        failureReason: error,
        failureCount: 1,
        errorUpdateCount: 1,
      }) as UseQueryResult<DailyStats | null>
    );

    const { container } = renderStreakCounter();
    expect(container.firstChild).toBeNull();
  });
});
