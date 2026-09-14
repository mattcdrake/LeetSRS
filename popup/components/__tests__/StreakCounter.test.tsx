/** @vitest-environment happy-dom */

import { render, screen, waitFor } from '@testing-library/react';
import { Rating } from 'ts-fsrs';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { storage } from '#imports';
import { formatLocalDate } from '@/domain/calendar';
import type { LearningDocument } from '@/domain/learning-document';
import type { DailyStats } from '@/domain/statistics';
import { sendMessage } from '@/integrations/browser/messages';
import { learningDocumentQueryKey } from '@/popup/queries/learning-document';
import { buildLearningDocument, setPopupLearningDocumentQueryData } from '@/test/utils/learning-document-mocks';
import { createMessageMock } from '@/test/utils/message-mocks';
import { createPopupTestWrapper } from '@/test/utils/test-wrapper';
import { StreakCounter } from '../StreakCounter';

vi.mock('@/integrations/browser/messages', () => ({ sendMessage: vi.fn() }));

const stats = (streak: number): DailyStats => ({
  gradeBreakdown: { [Rating.Again]: 1, [Rating.Hard]: 1, [Rating.Good]: 2, [Rating.Easy]: 1 },
  newCards: 2,
  streak,
});

describe('StreakCounter', () => {
  afterEach(() => vi.restoreAllMocks());

  const messages = createMessageMock(vi.mocked(sendMessage));

  const renderStats = (data: DailyStats | null) => {
    messages.reset();
    const { wrapper, queryClient } = createPopupTestWrapper();
    setPopupLearningDocumentQueryData(queryClient, { stats: data ? { [formatLocalDate(new Date())]: data } : {} });
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

  it('renders nothing while loading', async () => {
    const pending = Promise.withResolvers<LearningDocument>();
    const read = vi.spyOn(storage, 'getItem').mockReturnValue(pending.promise);
    messages.reset();
    const { wrapper, queryClient } = createPopupTestWrapper();
    const view = render(<StreakCounter />, { wrapper });
    await waitFor(() => expect(read).toHaveBeenCalled());
    expect(queryClient.getQueryState(learningDocumentQueryKey)).toMatchObject({
      status: 'pending',
      fetchStatus: 'fetching',
    });
    expect(view.container.firstChild).toBeNull();
    pending.resolve(buildLearningDocument());
    await waitFor(() => expect(queryClient.getQueryState(learningDocumentQueryKey)?.status).toBe('success'));
    view.unmount();
  });

  it('renders nothing after an error', async () => {
    const error = new Error('Failed to fetch stats');
    vi.spyOn(storage, 'getItem').mockRejectedValue(error);
    messages.reset();
    const { wrapper, queryClient } = createPopupTestWrapper();
    const view = render(<StreakCounter />, { wrapper });
    await waitFor(() =>
      expect(queryClient.getQueryState(learningDocumentQueryKey)).toMatchObject({ status: 'error', error })
    );
    expect(view.container.firstChild).toBeNull();
  });
});
