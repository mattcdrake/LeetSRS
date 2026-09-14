/**
 * @vitest-environment happy-dom
 */

import { render, screen } from '@testing-library/react';
import { State } from 'ts-fsrs';
import { describe, expect, it } from 'vitest';
import { formatLocalDate } from '@/shared/calendar';
import { createMockCard } from '@/test/utils/card-mocks';
import { setPopupLearningDocumentQueryData } from '@/test/utils/learning-document-mocks';
import { createTestWrapper } from '@/test/utils/test-wrapper';
import { StatsBar } from '../StatsBar';

describe('StatsBar', () => {
  it.each([0, 1, 2])('counts legacy cards as reviews with %i new cards completed today', (completed) => {
    const now = new Date('2024-03-15T12:00:00');
    const cards = [
      createMockCard(State.New, { slug: 'new-a' }),
      createMockCard(State.New, { slug: 'new-b' }),
      createMockCard(State.New, { slug: 'new-c' }),
      createMockCard(State.Review, { slug: 'review' }),
      createMockCard(State.Learning, { slug: 'learning' }),
      createMockCard(State.Relearning, { slug: 'relearning' }),
      createMockCard(State.Review, { slug: 'paused', paused: true }),
      createMockCard(State.Learning, { slug: 'future' }),
    ];
    for (const card of cards) {
      card.fsrs.due = now.getTime() + (card.slug === 'future' ? 1 : 0);
    }
    const { wrapper, queryClient } = createTestWrapper();
    setPopupLearningDocumentQueryData(
      queryClient,
      {
        cards: Object.fromEntries(cards.map((card) => [card.slug, card])),
        settings: { maxNewCardsPerDay: 2 },
        reviewActivity: { date: formatLocalDate(now), newCards: completed, streak: 1 },
      },
      now
    );

    render(<StatsBar />, { wrapper });

    expect(screen.getByTestId('stat-review')).toHaveTextContent('3review');
    expect(screen.getByTestId('stat-new')).toHaveTextContent(`${2 - completed}new`);
    expect(screen.queryByTestId('stat-learn')).not.toBeInTheDocument();
  });

  it('shows zero reviews and new cards for an empty queue', () => {
    const { wrapper, queryClient } = createTestWrapper();
    setPopupLearningDocumentQueryData(queryClient);

    render(<StatsBar />, { wrapper });

    expect(screen.getByTestId('stat-review')).toHaveTextContent('0review');
    expect(screen.getByTestId('stat-new')).toHaveTextContent('0new');
    expect(screen.queryByTestId('stat-learn')).not.toBeInTheDocument();
  });
});
