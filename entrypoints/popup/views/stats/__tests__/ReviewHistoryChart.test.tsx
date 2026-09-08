/**
 * @vitest-environment happy-dom
 */

import { render, screen } from '@testing-library/react';
import { Rating } from 'ts-fsrs';
import { describe, expect, it, vi } from 'vitest';
import type { DailyStats } from '@/domain/statistics';
import { I18nProvider } from '@/entrypoints/popup/contexts/I18nContext';
import { settingsQueryKeys } from '@/entrypoints/popup/queries/settings';
import { statsQueryKeys } from '@/entrypoints/popup/queries/stats';
import { translations } from '@/i18n';
import { sendMessage } from '@/infrastructure/browser/messages';
import { createMessageMock } from '@/test/utils/message-mocks';
import { buildSettings } from '@/test/utils/settings-mocks';
import { createTestWrapper } from '@/test/utils/test-wrapper';
import { ReviewHistoryChart } from '../ReviewHistoryChart';

// Mock react-chartjs-2
vi.mock('react-chartjs-2', () => ({
  Bar: ({ data, options }: { data: unknown; options: unknown }) => (
    <div data-testid="bar-chart" data-chart-data={JSON.stringify(data)} data-chart-options={JSON.stringify(options)}>
      Bar Chart
    </div>
  ),
}));

vi.mock('@/infrastructure/browser/messages', () => ({ sendMessage: vi.fn() }));

describe('Bar Chart (Last 30 Days Review History)', () => {
  const messages = createMessageMock(vi.mocked(sendMessage));

  // Default mock data
  const mockLast30DaysStats: DailyStats[] = [
    {
      date: '2024-05-15',
      totalReviews: 12,
      gradeBreakdown: {
        [Rating.Again]: 1,
        [Rating.Hard]: 2,
        [Rating.Good]: 5,
        [Rating.Easy]: 4,
      },
      newCards: 2,
      reviewedCards: 10,
      streak: 1,
    },
    {
      date: '2024-05-16',
      totalReviews: 18,
      gradeBreakdown: {
        [Rating.Again]: 2,
        [Rating.Hard]: 3,
        [Rating.Good]: 7,
        [Rating.Easy]: 6,
      },
      newCards: 3,
      reviewedCards: 15,
      streak: 2,
    },
  ];

  const renderChart = (data: DailyStats[] = mockLast30DaysStats, language: 'en' | 'pl' = 'en') => {
    const settings = buildSettings({ theme: 'light', language });
    messages.reset().resolve('getLastNDaysStats', data).resolve('getSettings', settings);
    const { wrapper, queryClient } = createTestWrapper();
    queryClient.setQueryData(statsQueryKeys.lastNDays.detail(30), data);
    queryClient.setQueryData(settingsQueryKeys.all, settings);
    return render(
      <I18nProvider>
        <ReviewHistoryChart />
      </I18nProvider>,
      { wrapper }
    );
  };

  it('should render the review history section', () => {
    renderChart();

    expect(screen.getByRole('heading', { name: 'Last 30 Days Review History' })).toBeInTheDocument();
  });

  it('should render the bar chart', () => {
    renderChart();

    const chart = screen.getByTestId('bar-chart');
    expect(chart).toBeInTheDocument();
  });

  it.each(['en', 'pl'] as const)('passes ordered localized datasets and correct grade counts in %s', (language) => {
    renderChart(mockLast30DaysStats, language);
    const t = translations[language];

    const chart = screen.getByTestId('bar-chart');
    const chartData = JSON.parse(chart.getAttribute('data-chart-data') || '{}');

    expect(chartData.labels).toEqual(['5/15', '5/16']);

    // Check datasets
    expect(chartData.datasets).toHaveLength(4);
    expect(chartData.datasets[0].label).toBe(t.ratings.again);
    expect(chartData.datasets[0].data).toEqual([1, 2]);
    expect(chartData.datasets[1].label).toBe(t.ratings.hard);
    expect(chartData.datasets[1].data).toEqual([2, 3]);
    expect(chartData.datasets[2].label).toBe(t.ratings.good);
    expect(chartData.datasets[2].data).toEqual([5, 7]);
    expect(chartData.datasets[3].label).toBe(t.ratings.easy);
    expect(chartData.datasets[3].data).toEqual([4, 6]);
  });

  it('should configure bar chart as stacked', () => {
    renderChart();

    const chart = screen.getByTestId('bar-chart');
    const chartOptions = JSON.parse(chart.getAttribute('data-chart-options') || '{}');

    expect(chartOptions.scales.x.stacked).toBe(true);
    expect(chartOptions.scales.y.stacked).toBe(true);
  });

  it('should handle empty data gracefully', () => {
    renderChart([]);

    const chart = screen.getByTestId('bar-chart');
    const chartData = JSON.parse(chart.getAttribute('data-chart-data') || '{}');

    expect(chartData.labels).toEqual([]);
    expect(chartData.datasets[0].data).toEqual([]);
    expect(chartData.datasets[1].data).toEqual([]);
    expect(chartData.datasets[2].data).toEqual([]);
    expect(chartData.datasets[3].data).toEqual([]);
  });

  it('should request exactly 30 days of data', () => {
    renderChart();

    expect(sendMessage).toHaveBeenCalledWith('getLastNDaysStats', { days: 30 });
  });

  it('should apply correct CSS classes to review history section', () => {
    renderChart();

    const reviewSection = screen.getByRole('heading', { name: 'Last 30 Days Review History' }).parentElement;
    expect(reviewSection).toHaveClass('mb-6', 'p-4', 'rounded-lg');
  });

  it('should set bar chart container height', () => {
    renderChart();

    const chartContainer = screen.getByTestId('bar-chart').parentElement;
    expect(chartContainer).toHaveStyle({ height: '250px' });
  });
});
