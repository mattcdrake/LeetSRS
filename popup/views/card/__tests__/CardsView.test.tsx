import { initializeCatalog } from '@/shared/catalog';
import {
  setPopupLearningCardsQueryData,
  setPopupLearningDocumentQueryData,
} from '@/test/utils/learning-document-mocks';
/**
 * @vitest-environment happy-dom
 */

import type { QueryClient } from '@tanstack/react-query';
import { act, fireEvent, render, screen } from '@testing-library/react';
import { State } from 'ts-fsrs';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { CardWithProblem } from '@/popup/queries/cards';
import { background } from '@/shared/background-service';
import { createMockCardWithProblem } from '@/test/utils/card-mocks';
import { createServiceMock } from '@/test/utils/service-mocks';
import { createTestWrapper } from '@/test/utils/test-wrapper';
import { CardsView } from '../CardsView';

vi.mock('@/shared/background-service');
vi.mock('@/popup/components/notes/NoteEditor', () => ({ NoteEditor: () => null }));

let queryClient: QueryClient;
let wrapper: ReturnType<typeof createTestWrapper>['wrapper'];

const renderWithQueryClient = (component: React.ReactElement) => {
  return render(component, { wrapper });
};

describe('CardsView', () => {
  const service = createServiceMock(background);
  const seedCards = (cards: CardWithProblem[]) => {
    setPopupLearningCardsQueryData(queryClient, cards);
  };

  beforeEach(() => {
    service.reset().resolve('waitForInitialization', undefined);
    ({ queryClient, wrapper } = createTestWrapper());
  });

  it('toggles independent filters alongside search, including when nothing matches', () => {
    const pausedNew = createMockCardWithProblem(State.New, { title: 'Paused new', frontendId: '1', paused: true });
    const activeNew = createMockCardWithProblem(State.New, { title: 'Active new', frontendId: '2' });
    const pausedReview = createMockCardWithProblem(State.Review, {
      title: 'Paused review',
      frontendId: '3',
      paused: true,
    });
    seedCards([pausedNew, activeNew, pausedReview]);
    renderWithQueryClient(<CardsView />);

    for (const name of ['Due', 'New', 'Paused']) {
      const button = screen.getByRole('button', { name });
      expect(button).toHaveAttribute('aria-pressed', 'false');
      fireEvent.click(button);
      expect(button).toHaveAttribute('aria-pressed', 'true');
    }
    expect(screen.getByText('Paused new')).toBeInTheDocument();
    expect(screen.queryByText('Active new')).not.toBeInTheDocument();
    expect(screen.queryByText('Paused review')).not.toBeInTheDocument();

    fireEvent.change(screen.getByRole('textbox'), { target: { value: 'review' } });
    expect(screen.getByText('No cards match your filter.')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'New' }));
    expect(screen.getByRole('button', { name: 'New' })).toHaveAttribute('aria-pressed', 'false');
    expect(screen.getByText('Paused review')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Clear filter' }));
    expect(screen.getByText('Paused new')).toBeInTheDocument();
    expect(screen.getByText('Paused review')).toBeInTheDocument();
    expect(screen.queryByText('Active new')).not.toBeInTheDocument();
    for (const name of ['Due', 'Paused']) fireEvent.click(screen.getByRole('button', { name }));
    expect(screen.getByText('Active new')).toBeInTheDocument();
  });

  it('resets filters and search when the Cards view remounts', () => {
    seedCards([createMockCardWithProblem(State.New)]);
    const view = renderWithQueryClient(<CardsView />);
    fireEvent.click(screen.getByRole('button', { name: 'Paused' }));
    fireEvent.change(screen.getByRole('textbox'), { target: { value: 'missing' } });
    view.rerender(<div />);
    view.rerender(<CardsView />);

    expect(screen.getByRole('textbox')).toHaveValue('');
    for (const name of ['Due', 'New', 'Paused']) {
      expect(screen.getByRole('button', { name })).toHaveAttribute('aria-pressed', 'false');
    }
    expect(screen.getByText('Two Sum')).toBeInTheDocument();
  });

  it('shows due new cards even when the daily new-card allowance is zero', () => {
    const card = createMockCardWithProblem(State.New);
    setPopupLearningDocumentQueryData(queryClient, {
      cards: { [card.frontendId]: card },
      settings: { maxNewCardsPerDay: 0 },
    });
    renderWithQueryClient(<CardsView />);
    fireEvent.click(screen.getByRole('button', { name: 'Due' }));
    fireEvent.click(screen.getByRole('button', { name: 'New' }));
    expect(screen.getByText('Two Sum')).toBeInTheDocument();
  });

  it.each(['tick', 'focus'] as const)('refreshes Due results on a clock %s', async (event) => {
    vi.useFakeTimers({ toFake: ['Date', 'setInterval', 'clearInterval'] });
    const card = createMockCardWithProblem(State.New, { paused: true });
    card.fsrs.due = Date.now() + 15_000;
    seedCards([card]);
    const view = renderWithQueryClient(<CardsView />);
    try {
      fireEvent.click(screen.getByRole('button', { name: 'Due' }));
      expect(screen.getByText('No cards match your filter.')).toBeInTheDocument();
      if (event === 'tick') {
        await act(() => vi.advanceTimersByTimeAsync(15_000));
      } else {
        vi.setSystemTime(card.fsrs.due);
        fireEvent.focus(window);
      }
      expect(screen.getByText('Two Sum')).toBeInTheDocument();
    } finally {
      view.unmount();
      vi.useRealTimers();
    }
  });

  it('should link cards to their problem on the stored LeetCode domain', () => {
    const cards = [
      createMockCardWithProblem(State.New, { title: 'Two Sum', slug: 'two-sum', domain: 'leetcode.com' }),
      createMockCardWithProblem(State.New, {
        title: 'Chinese Problem',
        translatedTitle: '中文题目',
        slug: 'chinese-problem',
        domain: 'leetcode.cn',
      }),
    ];

    seedCards(cards);

    renderWithQueryClient(<CardsView />);

    expect(screen.getByRole('link', { name: 'Open Two Sum on LeetCode' })).toHaveAttribute(
      'href',
      'https://leetcode.com/problems/two-sum/description/'
    );
    expect(screen.getByRole('link', { name: 'Open 中文题目 on LeetCode' })).toHaveAttribute(
      'href',
      'https://leetcode.cn/problems/chinese-problem/description/'
    );

    for (const link of screen.getAllByRole('link')) {
      expect(link).toHaveAttribute('target', '_blank');
      expect(link).toHaveAttribute('rel', 'noopener noreferrer');
    }
  });

  it('should filter cards, show no matches, and restore all cards when cleared', () => {
    const cards = [
      createMockCardWithProblem(State.New, { title: 'Two Sum', frontendId: '1' }),
      createMockCardWithProblem(State.New, { title: 'Add Two Numbers', frontendId: '2' }),
      createMockCardWithProblem(State.New, { title: 'Longest Substring', frontendId: '3' }),
    ];

    seedCards(cards);

    renderWithQueryClient(<CardsView />);

    expect(screen.getByText('Two Sum')).toBeInTheDocument();
    expect(screen.getByText('Add Two Numbers')).toBeInTheDocument();
    expect(screen.getByText('Longest Substring')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Clear filter' })).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /Two Sum/ }));
    expect(screen.getByRole('button', { name: /Two Sum/ })).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getByRole('button', { name: /Add Two Numbers/ })).toHaveAttribute('aria-expanded', 'false');
    const filterInput = screen.getByPlaceholderText('Filter by name or ID...');
    fireEvent.change(filterInput, { target: { value: 'Two' } });

    expect(screen.getByText('Two Sum')).toBeInTheDocument();
    expect(screen.getByText('Add Two Numbers')).toBeInTheDocument();
    expect(screen.queryByText('Longest Substring')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Clear filter' })).toBeInTheDocument();

    expect(screen.getByRole('button', { name: /Two Sum/ })).toHaveAttribute('aria-expanded', 'true');
    fireEvent.change(filterInput, { target: { value: 'xyz' } });

    expect(screen.getByText('No cards match your filter.')).toBeInTheDocument();
    expect(screen.queryByText('No cards added yet.')).not.toBeInTheDocument();
    expect(screen.queryByText('Two Sum')).not.toBeInTheDocument();
    expect(screen.queryByText('Add Two Numbers')).not.toBeInTheDocument();
    expect(screen.queryByText('Longest Substring')).not.toBeInTheDocument();
    expect(filterInput).toBeInTheDocument();
    expect(filterInput).toHaveValue('xyz');

    fireEvent.click(screen.getByRole('button', { name: 'Clear filter' }));

    expect(screen.getByText('Two Sum')).toBeInTheDocument();
    expect(screen.getByText('Add Two Numbers')).toBeInTheDocument();
    expect(screen.getByText('Longest Substring')).toBeInTheDocument();
    expect(screen.queryByText('No cards match your filter.')).not.toBeInTheDocument();
    expect(filterInput).toHaveValue('');
    expect(screen.getByRole('button', { name: /Two Sum/ })).toHaveAttribute('aria-expanded', 'false');
    expect(screen.queryByRole('button', { name: 'Clear filter' })).not.toBeInTheDocument();
  });
});

beforeEach(initializeCatalog);
