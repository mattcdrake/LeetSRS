/**
 * @vitest-environment happy-dom
 */

import { render, screen, waitFor } from '@testing-library/react';
import { State as FsrsState } from 'ts-fsrs';
import { describe, expect, it, vi } from 'vitest';
import { statsQueryKeys } from '@/entrypoints/popup/queries/stats';
import { sendMessage } from '@/infrastructure/browser/messages';
import { createDeferred } from '@/test/utils/deferred';
import { createMessageMock } from '@/test/utils/message-mocks';
import { createTestWrapper } from '@/test/utils/test-wrapper';
import { CardDistributionChart } from '../CardDistributionChart';

// Mock react-chartjs-2
vi.mock('react-chartjs-2', () => ({
  Doughnut: ({ data }: { data: unknown }) => (
    <div data-testid="doughnut-chart" data-chart-data={JSON.stringify(data)}>
      Doughnut Chart
    </div>
  ),
}));

vi.mock('@/infrastructure/browser/messages', () => ({ sendMessage: vi.fn() }));

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
    queryClient.setQueryData(statsQueryKeys.cardState, data);
    return render(<CardDistributionChart />, { wrapper });
  };

  it('should pass correct data to the doughnut chart', () => {
    renderChart();

    const chart = screen.getByTestId('doughnut-chart');
    const chartData = JSON.parse(chart.getAttribute('data-chart-data') || '{}');

    expect(screen.getByRole('heading', { name: 'Card Distribution' })).toBeInTheDocument();
    expect(chartData.labels).toEqual(['New', 'Learning', 'Review', 'Relearning']);
    expect(chartData.datasets[0].data).toEqual([5, 3, 8, 2]);
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
    it('should handle error state gracefully', async () => {
      messages.reset().handle('getCardStateStats', () => Promise.reject(new Error('Failed to fetch stats')));
      const { wrapper, queryClient } = createTestWrapper();
      render(<CardDistributionChart />, { wrapper });
      await waitFor(() => expect(queryClient.getQueryState(statsQueryKeys.cardState)?.status).toBe('error'));

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
  });
});
