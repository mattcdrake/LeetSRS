/** @vitest-environment happy-dom */
import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { Card } from '@/domain/cards';
import { LearningState as State } from '@/domain/scheduling';
import { sendMessage } from '@/integrations/browser/messages';
import { createMockCard } from '@/test/utils/card-mocks';
import { setPopupLearningCardsQueryData } from '@/test/utils/learning-document-mocks';
import { createMessageMock } from '@/test/utils/message-mocks';
import { createPopupTestWrapper } from '@/test/utils/test-wrapper';
import { StatsBar } from '../StatsBar';

vi.mock('@/integrations/browser/messages', () => ({ sendMessage: vi.fn() }));

describe('StatsBar', () => {
  const messages = createMessageMock(vi.mocked(sendMessage));

  const renderStats = (cards: Card[] = []) => {
    messages.reset();
    const { wrapper, queryClient } = createPopupTestWrapper();
    setPopupLearningCardsQueryData(queryClient, cards);
    return render(<StatsBar />, { wrapper });
  };

  it('renders all categories with zero counts for an empty queue', () => {
    renderStats();
    expect(screen.getByTestId('stat-review-count')).toHaveTextContent('0');
    expect(screen.getByTestId('stat-new-count')).toHaveTextContent('0');
    expect(screen.getByTestId('stat-learn-count')).toHaveTextContent('0');
  });

  it('counts review, new, learning, and relearning cards', () => {
    renderStats([
      ...Array.from({ length: 5 }, () => createMockCard(State.Review)),
      ...Array.from({ length: 3 }, () => createMockCard(State.New)),
      createMockCard(State.Learning),
      createMockCard(State.Learning),
      createMockCard(State.Relearning),
    ]);
    expect(screen.getByTestId('stat-review-count')).toHaveTextContent('5');
    expect(screen.getByTestId('stat-new-count')).toHaveTextContent('3');
    expect(screen.getByTestId('stat-learn-count')).toHaveTextContent('3');
  });

  it('ignores unknown states', () => {
    const card = createMockCard(State.New);
    renderStats([
      createMockCard(State.Review),
      createMockCard(State.New),
      createMockCard(State.Learning),
      { ...card, fsrs: { ...card.fsrs, state: 999 as State } },
    ]);
    expect(screen.getByTestId('stat-review-count')).toHaveTextContent('1');
    expect(screen.getByTestId('stat-new-count')).toHaveTextContent('1');
    expect(screen.getByTestId('stat-learn-count')).toHaveTextContent('1');
  });

  it('handles large counts', () => {
    renderStats(Array.from({ length: 999 }, () => createMockCard(State.Review)));
    expect(screen.getByTestId('stat-review-count')).toHaveTextContent('999');
  });
});
