/**
 * @vitest-environment happy-dom
 */

import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { UpcomingReviewStats } from '@/domain/statistics';
import { statsQueryKeys } from '@/entrypoints/popup/queries/stats';
import { sendMessage } from '@/infrastructure/browser/messages';
import { createMessageMock } from '@/test/utils/message-mocks';
import { createTestWrapper } from '@/test/utils/test-wrapper';
import { UpcomingReviewsChart } from '../UpcomingReviewsChart';

// Mock react-chartjs-2
vi.mock('react-chartjs-2', () => ({
  Line: ({ data }: { data: unknown }) => (
    <div data-testid="line-chart" data-chart-data={JSON.stringify(data)}>
      Line Chart
    </div>
  ),
}));

vi.mock('@/infrastructure/browser/messages', () => ({ sendMessage: vi.fn() }));

describe('UpcomingReviewsChart', () => {
  const messages = createMessageMock(vi.mocked(sendMessage));

  // Default mock data
  const mockNext14DaysStats: UpcomingReviewStats[] = [
    {
      date: '2024-05-15',
      count: 5,
    },
    {
      date: '2024-05-16',
      count: 0,
    },
    {
      date: '2024-05-17',
      count: 8,
    },
  ];

  const renderChart = (data: UpcomingReviewStats[] = mockNext14DaysStats) => {
    messages.reset();
    const { wrapper, queryClient } = createTestWrapper();
    queryClient.setQueryData(statsQueryKeys.nextNDays.detail(14), data);
    return render(<UpcomingReviewsChart />, { wrapper });
  };

  it('should pass correct data to the line chart', () => {
    renderChart();

    const chart = screen.getByTestId('line-chart');
    const chartData = JSON.parse(chart.getAttribute('data-chart-data') || '{}');

    expect(chartData.labels).toEqual(['5/15', '5/16', '5/17']);
    expect(screen.getByRole('heading', { name: 'Upcoming Reviews (Next 14 Days)' })).toBeInTheDocument();

    // Check dataset
    expect(chartData.datasets).toHaveLength(1);
    expect(chartData.datasets[0].label).toBe('Cards Due');
    expect(chartData.datasets[0].data).toEqual([5, 0, 8]);
  });

  it('should handle empty data gracefully', () => {
    renderChart([]);

    const chart = screen.getByTestId('line-chart');
    const chartData = JSON.parse(chart.getAttribute('data-chart-data') || '{}');

    expect(chartData.labels).toEqual([]);
    expect(chartData.datasets[0].data).toEqual([]);
  });

  it('should handle loading state gracefully', () => {
    const pending = Promise.withResolvers<UpcomingReviewStats[]>();
    messages.reset();
    const { wrapper } = createTestWrapper();
    const view = render(<UpcomingReviewsChart />, { wrapper });

    // Chart should still render with empty data
    const chart = screen.getByTestId('line-chart');
    expect(chart).toBeInTheDocument();

    const chartData = JSON.parse(chart.getAttribute('data-chart-data') || '{}');
    expect(chartData.labels).toEqual([]);
    expect(chartData.datasets[0].data).toEqual([]);
    view.unmount();
    pending.resolve([]);
  });
});
