/**
 * @vitest-environment happy-dom
 */

import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { createTestWrapper } from '@/test/utils/test-wrapper';
import { StatsView } from '../StatsView';

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

  it('renders the streak in the header and all three charts', () => {
    renderStatsView();

    expect(screen.getByTestId('header-content')).toContainElement(screen.getByTestId('streak-counter'));
    expect(screen.getByTestId('card-distribution-chart')).toBeInTheDocument();
    expect(screen.getByTestId('review-history-chart')).toBeInTheDocument();
    expect(screen.getByTestId('upcoming-reviews-chart')).toBeInTheDocument();
  });
});
