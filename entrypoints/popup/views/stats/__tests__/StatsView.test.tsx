/**
 * @vitest-environment happy-dom
 */
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { StatsView } from '../StatsView';
import { createTestWrapper } from '@/test/utils/test-wrapper';

// Mock the ViewLayout component
vi.mock('../../../components/ViewLayout', () => ({
  ViewLayout: ({ children, headerContent }: { children: React.ReactNode; headerContent?: React.ReactNode }) => (
    <div>
      {headerContent && <div data-testid="header-content">{headerContent}</div>}
      {children}
    </div>
  ),
}));

// Mock the StreakCounter component
vi.mock('../../../components/StreakCounter', () => ({
  StreakCounter: () => <div data-testid="streak-counter">Streak Counter</div>,
}));

// Mock the chart components
vi.mock('../CardDistributionChart', () => ({
  CardDistributionChart: () => <div data-testid="card-distribution-chart">Card Distribution Chart</div>,
}));

vi.mock('../ReviewHistoryChart', () => ({
  ReviewHistoryChart: () => <div data-testid="review-history-chart">Review History Chart</div>,
}));

vi.mock('../UpcomingReviewsChart', () => ({
  UpcomingReviewsChart: () => <div data-testid="upcoming-reviews-chart">Upcoming Reviews Chart</div>,
}));

describe('StatsView', () => {
  const { wrapper } = createTestWrapper();

  const renderStatsView = () => {
    return render(<StatsView />, { wrapper });
  };

  it('should render the streak counter in header', () => {
    renderStatsView();

    const headerContent = screen.getByTestId('header-content');
    expect(headerContent).toBeInTheDocument();
    expect(screen.getByTestId('streak-counter')).toBeInTheDocument();
  });

  it('should render all three chart components', () => {
    renderStatsView();

    expect(screen.getByTestId('card-distribution-chart')).toBeInTheDocument();
    expect(screen.getByTestId('review-history-chart')).toBeInTheDocument();
    expect(screen.getByTestId('upcoming-reviews-chart')).toBeInTheDocument();
  });

  it('should render charts in correct order', () => {
    renderStatsView();

    const charts = screen.getAllByTestId(/chart$/);
    expect(charts).toHaveLength(3);
    expect(charts[0]).toHaveAttribute('data-testid', 'card-distribution-chart');
    expect(charts[1]).toHaveAttribute('data-testid', 'review-history-chart');
    expect(charts[2]).toHaveAttribute('data-testid', 'upcoming-reviews-chart');
  });
});
