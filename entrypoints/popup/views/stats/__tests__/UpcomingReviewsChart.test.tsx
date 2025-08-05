/**
 * @vitest-environment happy-dom
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { UpcomingReviewsChart } from '../UpcomingReviewsChart';
import { createTestWrapper } from '@/test/utils/test-wrapper';
import { createQueryMock } from '@/test/utils/query-mocks';
import { useNextNDaysStatsQuery } from '@/hooks/useBackgroundQueries';
import type { UseQueryResult } from '@tanstack/react-query';
import type { UpcomingReviewStats } from '@/services/stats';

// Mock react-chartjs-2
vi.mock('react-chartjs-2', () => ({
  Line: ({ data, options }: { data: unknown; options: unknown }) => (
    <div data-testid="line-chart" data-chart-data={JSON.stringify(data)} data-chart-options={JSON.stringify(options)}>
      Line Chart
    </div>
  ),
}));

// Mock the query hook
vi.mock('@/hooks/useBackgroundQueries', () => ({
  useNextNDaysStatsQuery: vi.fn(),
}));

describe('UpcomingReviewsChart', () => {
  const { wrapper } = createTestWrapper();

  // Default mock data
  const mockNext14DaysStats: UpcomingReviewStats[] = [
    {
      date: '2024-05-15',
      count: 5,
    },
    {
      date: '2024-05-16',
      count: 3,
    },
    {
      date: '2024-05-17',
      count: 8,
    },
  ];

  beforeEach(() => {
    vi.clearAllMocks();

    // Default mock - return stats data
    vi.mocked(useNextNDaysStatsQuery).mockReturnValue(
      createQueryMock(mockNext14DaysStats) as UseQueryResult<UpcomingReviewStats[]>
    );
  });

  const renderChart = () => {
    return render(<UpcomingReviewsChart />, { wrapper });
  };

  it('should render the upcoming reviews section', () => {
    renderChart();

    expect(screen.getByRole('heading', { name: 'Upcoming Reviews (Next 14 Days)' })).toBeInTheDocument();
  });

  it('should render the line chart', () => {
    renderChart();

    const chart = screen.getByTestId('line-chart');
    expect(chart).toBeInTheDocument();
  });

  it('should pass correct data to the line chart', () => {
    renderChart();

    const chart = screen.getByTestId('line-chart');
    const chartData = JSON.parse(chart.getAttribute('data-chart-data') || '{}');

    // Check labels exist and are formatted as MM/DD
    expect(chartData.labels).toHaveLength(3);
    expect(chartData.labels[0]).toMatch(/^\d{1,2}\/\d{1,2}$/);
    expect(chartData.labels[1]).toMatch(/^\d{1,2}\/\d{1,2}$/);
    expect(chartData.labels[2]).toMatch(/^\d{1,2}\/\d{1,2}$/);

    // Check dataset
    expect(chartData.datasets).toHaveLength(1);
    expect(chartData.datasets[0].label).toBe('Cards Due');
    expect(chartData.datasets[0].data).toEqual([5, 3, 8]);
  });

  it('should use correct styling for the line', () => {
    renderChart();

    const chart = screen.getByTestId('line-chart');
    const chartData = JSON.parse(chart.getAttribute('data-chart-data') || '{}');

    expect(chartData.datasets[0].borderColor).toBe('#3b82f6');
    expect(chartData.datasets[0].backgroundColor).toBe('rgba(59, 130, 246, 0.1)');
    expect(chartData.datasets[0].tension).toBe(0.1);
  });

  it('should configure line chart options correctly', () => {
    renderChart();

    const chart = screen.getByTestId('line-chart');
    const chartOptions = JSON.parse(chart.getAttribute('data-chart-options') || '{}');

    expect(chartOptions.responsive).toBe(true);
    expect(chartOptions.maintainAspectRatio).toBe(false);
    expect(chartOptions.scales.y.beginAtZero).toBe(true);
    expect(chartOptions.scales.y.ticks.stepSize).toBe(1);
    expect(chartOptions.plugins.legend.display).toBe(false);
  });

  it('should handle empty data gracefully', () => {
    vi.mocked(useNextNDaysStatsQuery).mockReturnValue(
      createQueryMock<UpcomingReviewStats[] | undefined>(undefined) as UseQueryResult<UpcomingReviewStats[]>
    );

    renderChart();

    const chart = screen.getByTestId('line-chart');
    const chartData = JSON.parse(chart.getAttribute('data-chart-data') || '{}');

    expect(chartData.labels).toEqual([]);
    expect(chartData.datasets[0].data).toEqual([]);
  });

  it('should request exactly 14 days of data', () => {
    renderChart();

    expect(useNextNDaysStatsQuery).toHaveBeenCalledWith(14);
  });

  it('should apply correct CSS classes to upcoming reviews section', () => {
    renderChart();

    const section = screen.getByRole('heading', { name: 'Upcoming Reviews (Next 14 Days)' }).parentElement;
    expect(section).toHaveClass('mb-6', 'p-4', 'rounded-lg', 'bg-secondary', 'text-primary');
  });

  it('should set line chart container height', () => {
    renderChart();

    const chartContainer = screen.getByTestId('line-chart').parentElement;
    expect(chartContainer).toHaveStyle({ height: '250px' });
  });

  it('should handle loading state gracefully', () => {
    vi.mocked(useNextNDaysStatsQuery).mockReturnValue(
      createQueryMock<UpcomingReviewStats[] | undefined>(undefined, {
        isLoading: true,
        isPending: true,
        isSuccess: false,
        isFetching: true,
        isFetched: false,
        status: 'pending',
        fetchStatus: 'fetching',
        dataUpdatedAt: 0,
      }) as UseQueryResult<UpcomingReviewStats[]>
    );

    renderChart();

    // Chart should still render with empty data
    const chart = screen.getByTestId('line-chart');
    expect(chart).toBeInTheDocument();

    const chartData = JSON.parse(chart.getAttribute('data-chart-data') || '{}');
    expect(chartData.labels).toEqual([]);
    expect(chartData.datasets[0].data).toEqual([]);
  });

  it('should handle dates with no reviews', () => {
    const statsWithZeros: UpcomingReviewStats[] = [
      { date: '2024-05-15', count: 5 },
      { date: '2024-05-16', count: 0 },
      { date: '2024-05-17', count: 3 },
      { date: '2024-05-18', count: 0 },
      { date: '2024-05-19', count: 7 },
    ];

    vi.mocked(useNextNDaysStatsQuery).mockReturnValue(
      createQueryMock(statsWithZeros) as UseQueryResult<UpcomingReviewStats[]>
    );

    renderChart();

    const chart = screen.getByTestId('line-chart');
    const chartData = JSON.parse(chart.getAttribute('data-chart-data') || '{}');

    expect(chartData.datasets[0].data).toEqual([5, 0, 3, 0, 7]);
  });
});
