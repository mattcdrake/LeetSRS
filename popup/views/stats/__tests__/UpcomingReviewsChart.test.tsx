/**
 * @vitest-environment happy-dom
 */

import { render, screen, waitFor } from '@testing-library/react';
import { State } from 'ts-fsrs';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { storage } from '#imports';
import { learningDocumentQueryKey } from '@/popup/queries/learning-document';
import type { UpcomingReviewStats } from '@/popup/queries/statistics';
import { sendMessage } from '@/shared/messages';
import type { LearningDocument } from '@/shared/models';
import { createMockCard } from '@/test/utils/card-mocks';
import { buildLearningDocument, setPopupLearningCardsQueryData } from '@/test/utils/learning-document-mocks';
import { createMessageMock } from '@/test/utils/message-mocks';
import { createPopupTestWrapper } from '@/test/utils/test-wrapper';
import { UpcomingReviewsChart } from '../UpcomingReviewsChart';

// Mock react-chartjs-2
vi.mock('react-chartjs-2', () => ({
  Line: ({ data }: { data: unknown }) => (
    <div data-testid="line-chart" data-chart-data={JSON.stringify(data)}>
      Line Chart
    </div>
  ),
}));

vi.mock('@/shared/messages', () => ({ sendMessage: vi.fn() }));

describe('UpcomingReviewsChart', () => {
  afterEach(() => vi.restoreAllMocks());

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
    const { wrapper, queryClient } = createPopupTestWrapper();
    const cards = data.flatMap(({ date, count }) =>
      Array.from({ length: count }, (_, index) => {
        const card = createMockCard(State.Review, { slug: `${date}-${index}`, id: `${date}-${index}` });
        card.fsrs.due = new Date(`${date}T12:00:00`).getTime();
        return card;
      })
    );
    setPopupLearningCardsQueryData(queryClient, cards, new Date('2024-05-15T12:00:00'));
    return render(<UpcomingReviewsChart />, { wrapper });
  };

  it('should pass correct data to the line chart', () => {
    renderChart();

    const chart = screen.getByTestId('line-chart');
    const chartData = JSON.parse(chart.getAttribute('data-chart-data') || '{}');

    expect(chartData.labels.slice(0, 3)).toEqual(['5/15', '5/16', '5/17']);
    expect(screen.getByRole('heading', { name: 'Upcoming Reviews (Next 14 Days)' })).toBeInTheDocument();

    // Check dataset
    expect(chartData.datasets).toHaveLength(1);
    expect(chartData.datasets[0].label).toBe('Cards Due');
    expect(chartData.datasets[0].data.slice(0, 3)).toEqual([5, 0, 8]);
  });

  it('should handle empty data gracefully', () => {
    renderChart([]);

    const chart = screen.getByTestId('line-chart');
    const chartData = JSON.parse(chart.getAttribute('data-chart-data') || '{}');

    expect(chartData.labels).toHaveLength(14);
    expect(chartData.datasets[0].data).toEqual(Array(14).fill(0));
  });

  it('should handle loading state gracefully', async () => {
    const pending = Promise.withResolvers<LearningDocument>();
    const read = vi.spyOn(storage, 'getItem').mockReturnValue(pending.promise);
    messages.reset();
    const { wrapper, queryClient } = createPopupTestWrapper();
    const view = render(<UpcomingReviewsChart />, { wrapper });

    await waitFor(() => expect(read).toHaveBeenCalled());
    expect(queryClient.getQueryState(learningDocumentQueryKey)).toMatchObject({
      status: 'pending',
      fetchStatus: 'fetching',
    });
    // Chart should still render with empty data
    const chart = screen.getByTestId('line-chart');
    expect(chart).toBeInTheDocument();

    const chartData = JSON.parse(chart.getAttribute('data-chart-data') || '{}');
    expect(chartData.labels).toEqual([]);
    expect(chartData.datasets[0].data).toEqual([]);
    pending.resolve(buildLearningDocument());
    await waitFor(() => expect(queryClient.getQueryState(learningDocumentQueryKey)?.status).toBe('success'));
    view.unmount();
  });
});
