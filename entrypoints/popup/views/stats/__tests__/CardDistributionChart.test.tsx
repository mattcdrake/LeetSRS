/**
 * @vitest-environment happy-dom
 */

import { render, screen } from '@testing-library/react';
import { State as FsrsState } from 'ts-fsrs';
import { describe, expect, it, vi } from 'vitest';
import { queryKeys } from '@/hooks/useBackgroundQueries';
import { sendMessage } from '@/shared/messages';
import { createDeferred } from '@/test/utils/deferred';
import { createMessageMock } from '@/test/utils/message-mocks';
import { createTestWrapper } from '@/test/utils/test-wrapper';
import { CardDistributionChart } from '../CardDistributionChart';

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

vi.mock('@/shared/messages', () => ({ sendMessage: vi.fn() }));

describe('CardDistributionChart', () => {
  const messages = createMessageMock(vi.mocked(sendMessage));

  // Default mock data
  const mockCardStateStats: Record<FsrsState, number> = {
    [FsrsState.New]: 5,
    [FsrsState.Learning]: 3,
    [FsrsState.Review]: 8,
    [FsrsState.Relearning]: 2,
  };

  const renderChart = (data: Record<FsrsState, number> = mockCardStateStats) => {
    messages.reset().resolve('getCardStateStats', data);
    const { wrapper, queryClient } = createTestWrapper();
    queryClient.setQueryData(queryKeys.stats.cardState, data);
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
    const pending = createDeferred<Record<FsrsState, number>>();
    messages.reset().resolve('getCardStateStats', pending.promise);
    const { wrapper } = createTestWrapper();
    const view = render(<CardDistributionChart />, { wrapper });

    const chart = screen.getByTestId('doughnut-chart');
    const chartData = JSON.parse(chart.getAttribute('data-chart-data') || '{}');

    expect(chartData.datasets[0].data).toEqual([0, 0, 0, 0]);
    view.unmount();
    pending.resolve(mockCardStateStats);
  });

  it('should set chart container height', () => {
    renderChart();

    const chartContainer = screen.getByTestId('doughnut-chart').parentElement;
    expect(chartContainer).toHaveStyle({ height: '200px' });
  });

  describe('loading state', () => {
    it('should handle loading state gracefully', () => {
      const pending = createDeferred<Record<FsrsState, number>>();
      messages.reset().resolve('getCardStateStats', pending.promise);
      const { wrapper } = createTestWrapper();
      const view = render(<CardDistributionChart />, { wrapper });

      // Chart should still render with default data
      const chart = screen.getByTestId('doughnut-chart');
      expect(chart).toBeInTheDocument();

      const chartData = JSON.parse(chart.getAttribute('data-chart-data') || '{}');
      expect(chartData.datasets[0].data).toEqual([0, 0, 0, 0]);
      view.unmount();
      pending.resolve(mockCardStateStats);
    });
  });

  describe('error state', () => {
    it('should handle error state gracefully', () => {
      messages.reset().handle('getCardStateStats', () => Promise.reject(new Error('Failed to fetch stats')));
      const { wrapper } = createTestWrapper();
      render(<CardDistributionChart />, { wrapper });

      // Chart should still render with default data
      const chart = screen.getByTestId('doughnut-chart');
      expect(chart).toBeInTheDocument();

      const chartData = JSON.parse(chart.getAttribute('data-chart-data') || '{}');
      expect(chartData.datasets[0].data).toEqual([0, 0, 0, 0]);
    });
  });

  describe('data edge cases', () => {
    it('should handle all zero values', () => {
      renderChart({
        [FsrsState.New]: 0,
        [FsrsState.Learning]: 0,
        [FsrsState.Review]: 0,
        [FsrsState.Relearning]: 0,
      });

      const chart = screen.getByTestId('doughnut-chart');
      const chartData = JSON.parse(chart.getAttribute('data-chart-data') || '{}');

      expect(chartData.datasets[0].data).toEqual([0, 0, 0, 0]);
    });

    it('should handle large numbers', () => {
      renderChart({
        [FsrsState.New]: 1000,
        [FsrsState.Learning]: 500,
        [FsrsState.Review]: 2500,
        [FsrsState.Relearning]: 100,
      });

      const chart = screen.getByTestId('doughnut-chart');
      const chartData = JSON.parse(chart.getAttribute('data-chart-data') || '{}');

      expect(chartData.datasets[0].data).toEqual([1000, 500, 2500, 100]);
    });
  });
});
