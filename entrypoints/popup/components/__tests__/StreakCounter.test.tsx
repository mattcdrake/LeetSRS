/** @vitest-environment happy-dom */
import { render, screen } from '@testing-library/react';
import { Rating } from 'ts-fsrs';
import { describe, expect, it, vi } from 'vitest';
import type { DailyStats } from '@/domain/statistics';
import { statsQueryKeys } from '@/entrypoints/popup/queries/stats';
import { sendMessage } from '@/infrastructure/browser/messages';
import { createMessageMock } from '@/test/utils/message-mocks';
import { createTestWrapper } from '@/test/utils/test-wrapper';
import { StreakCounter } from '../StreakCounter';

vi.mock('@/infrastructure/browser/messages', () => ({ sendMessage: vi.fn() }));

const stats = (streak: number): DailyStats => ({
  date: '2024-03-15',
  totalReviews: 5,
  gradeBreakdown: { [Rating.Again]: 1, [Rating.Hard]: 1, [Rating.Good]: 2, [Rating.Easy]: 1 },
  newCards: 2,
  reviewedCards: 3,
  streak,
});

describe('StreakCounter', () => {
  const messages = createMessageMock(vi.mocked(sendMessage));

  const renderStats = (data: DailyStats | null) => {
    messages.reset().resolve('getTodayStats', data);
    const { wrapper, queryClient } = createTestWrapper();
    queryClient.setQueryData(statsQueryKeys.today, data);
    return render(<StreakCounter />, { wrapper });
  };

  it.each([null, stats(0)])('does not render without an active streak', (data) => {
    expect(renderStats(data).container.firstChild).toBeNull();
  });

  it('renders and styles the streak', () => {
    const { container } = renderStats(stats(365));
    expect(screen.getByText('365')).toBeInTheDocument();

    expect(container.firstChild).toHaveClass('flex', 'items-center', 'gap-1', 'text-sm', 'font-medium');
  });

  it('renders nothing while loading', () => {
    const pending = Promise.withResolvers<DailyStats | null>();
    messages.reset().resolve('getTodayStats', pending.promise);
    const { wrapper } = createTestWrapper();
    const view = render(<StreakCounter />, { wrapper });
    expect(view.container.firstChild).toBeNull();
    view.unmount();
    pending.resolve(null);
  });

  it('renders nothing after an error', async () => {
    messages.reset().handle('getTodayStats', () => Promise.reject(new Error('Failed to fetch stats')));
    const { wrapper } = createTestWrapper();
    const view = render(<StreakCounter />, { wrapper });
    expect(view.container.firstChild).toBeNull();
  });
});
