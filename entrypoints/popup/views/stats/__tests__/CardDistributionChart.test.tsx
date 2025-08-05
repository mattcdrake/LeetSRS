/**
 * @vitest-environment happy-dom
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { CardDistributionChart } from '../CardDistributionChart';
import { State as FsrsState } from 'ts-fsrs';
import { createTestWrapper } from '@/test/utils/test-wrapper';
import { createQueryMock } from '@/test/utils/query-mocks';
import { useCardStateStatsQuery } from '@/hooks/useBackgroundQueries';
import type { UseQueryResult } from '@tanstack/react-query';

// Mock react-chartjs-2
vi.mock('react-chartjs-2', () => ({
  Doughnut: ({ data, options }: { data: unknown; options: unknown }) => (
    <div
      data-testid="doughnut-chart"
      data-chart-data={JSON.stringify(data)}
      data-chart-options={JSON.stringify(options)}
    >
      Doughnut Chart
    </div>
  ),
}));

// Mock the query hook
vi.mock('@/hooks/useBackgroundQueries', () => ({
  useCardStateStatsQuery: vi.fn(),
}));

describe('CardDistributionChart', () => {
  const { wrapper } = createTestWrapper();

  // Default mock data
  const mockCardStateStats: Record<FsrsState, number> = {
    [FsrsState.New]: 5,
    [FsrsState.Learning]: 3,
    [FsrsState.Review]: 8,
    [FsrsState.Relearning]: 2,
  };

  beforeEach(() => {
    vi.clearAllMocks();

    // Default mock - return stats data
    vi.mocked(useCardStateStatsQuery).mockReturnValue(
      createQueryMock(mockCardStateStats) as UseQueryResult<Record<FsrsState, number>>
    );
  });

  const renderChart = () => {
    return render(<CardDistributionChart />, { wrapper });
  };

  it('should render the card distribution section', () => {
    renderChart();

    expect(screen.getByRole('heading', { name: 'Card Distribution' })).toBeInTheDocument();
  });

  it('should render the doughnut chart', () => {
    renderChart();

    const chart = screen.getByTestId('doughnut-chart');
    expect(chart).toBeInTheDocument();
  });

  it('should pass correct data to the doughnut chart', () => {
    renderChart();

    const chart = screen.getByTestId('doughnut-chart');
    const chartData = JSON.parse(chart.getAttribute('data-chart-data') || '{}');

    expect(chartData.labels).toEqual(['New', 'Learning', 'Review', 'Relearning']);
    expect(chartData.datasets[0].data).toEqual([5, 3, 8, 2]);
  });

  it('should use correct colors for chart segments', () => {
    renderChart();

    const chart = screen.getByTestId('doughnut-chart');
    const chartData = JSON.parse(chart.getAttribute('data-chart-data') || '{}');

    expect(chartData.datasets[0].backgroundColor).toEqual([
      '#3b82f6', // blue for New
      '#f59e0b', // amber for Learning
      '#10b981', // emerald for Review
      '#ef4444', // red for Relearning
    ]);
  });

  it('should render chart with correct options', () => {
    renderChart();

    const chart = screen.getByTestId('doughnut-chart');
    const chartOptions = JSON.parse(chart.getAttribute('data-chart-options') || '{}');

    expect(chartOptions.responsive).toBe(true);
    expect(chartOptions.maintainAspectRatio).toBe(false);
    expect(chartOptions.plugins.legend.position).toBe('top');
  });

  it('should render zeros when no stats data is available', () => {
    vi.mocked(useCardStateStatsQuery).mockReturnValue(
      createQueryMock<Record<FsrsState, number> | undefined>(undefined) as UseQueryResult<Record<FsrsState, number>>
    );

    renderChart();

    const chart = screen.getByTestId('doughnut-chart');
    const chartData = JSON.parse(chart.getAttribute('data-chart-data') || '{}');

    expect(chartData.datasets[0].data).toEqual([0, 0, 0, 0]);
  });

  it('should set chart container height', () => {
    renderChart();

    const chartContainer = screen.getByTestId('doughnut-chart').parentElement;
    expect(chartContainer).toHaveStyle({ height: '200px' });
  });

  describe('loading state', () => {
    it('should handle loading state gracefully', () => {
      vi.mocked(useCardStateStatsQuery).mockReturnValue(
        createQueryMock<Record<FsrsState, number> | undefined>(undefined, {
          isLoading: true,
          isPending: true,
          isSuccess: false,
          isFetching: true,
          isFetched: false,
          status: 'pending',
          fetchStatus: 'fetching',
          dataUpdatedAt: 0,
        }) as UseQueryResult<Record<FsrsState, number>>
      );

      renderChart();

      // Chart should still render with default data
      const chart = screen.getByTestId('doughnut-chart');
      expect(chart).toBeInTheDocument();

      const chartData = JSON.parse(chart.getAttribute('data-chart-data') || '{}');
      expect(chartData.datasets[0].data).toEqual([0, 0, 0, 0]);
    });
  });

  describe('error state', () => {
    it('should handle error state gracefully', () => {
      const error = new Error('Failed to fetch stats');
      vi.mocked(useCardStateStatsQuery).mockReturnValue(
        createQueryMock<Record<FsrsState, number> | undefined>(undefined, {
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
        }) as UseQueryResult<Record<FsrsState, number>>
      );

      renderChart();

      // Chart should still render with default data
      const chart = screen.getByTestId('doughnut-chart');
      expect(chart).toBeInTheDocument();

      const chartData = JSON.parse(chart.getAttribute('data-chart-data') || '{}');
      expect(chartData.datasets[0].data).toEqual([0, 0, 0, 0]);
    });
  });

  describe('data edge cases', () => {
    it('should handle all zero values', () => {
      vi.mocked(useCardStateStatsQuery).mockReturnValue(
        createQueryMock({
          [FsrsState.New]: 0,
          [FsrsState.Learning]: 0,
          [FsrsState.Review]: 0,
          [FsrsState.Relearning]: 0,
        }) as UseQueryResult<Record<FsrsState, number>>
      );

      renderChart();

      const chart = screen.getByTestId('doughnut-chart');
      const chartData = JSON.parse(chart.getAttribute('data-chart-data') || '{}');

      expect(chartData.datasets[0].data).toEqual([0, 0, 0, 0]);
    });

    it('should handle large numbers', () => {
      vi.mocked(useCardStateStatsQuery).mockReturnValue(
        createQueryMock({
          [FsrsState.New]: 1000,
          [FsrsState.Learning]: 500,
          [FsrsState.Review]: 2500,
          [FsrsState.Relearning]: 100,
        }) as UseQueryResult<Record<FsrsState, number>>
      );

      renderChart();

      const chart = screen.getByTestId('doughnut-chart');
      const chartData = JSON.parse(chart.getAttribute('data-chart-data') || '{}');

      expect(chartData.datasets[0].data).toEqual([1000, 500, 2500, 100]);
    });
  });
});
