import { storage } from '#imports';
import { buildLearningDocument, setPopupLearningCardsQueryData } from '@/test/utils/learning-document-mocks';
/**
 * @vitest-environment happy-dom
 */

import type { QueryClient } from '@tanstack/react-query';
import { fireEvent, render, screen, within } from '@testing-library/react';
import { State } from 'ts-fsrs';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { sendMessage } from '@/shared/messages';
import type { Card } from '@/shared/models';
import { requireDefined } from '@/test/utils/assertions';
import { createMockCard } from '@/test/utils/card-mocks';
import { createMessageMock } from '@/test/utils/message-mocks';
import { createTestWrapper } from '@/test/utils/test-wrapper';
import { CardView } from '../CardView';

vi.mock('@/shared/messages', () => ({ sendMessage: vi.fn() }));
vi.mock('@/popup/components/notes/NoteEditor', () => ({ NoteEditor: () => null }));

let queryClient: QueryClient;
let wrapper: ReturnType<typeof createTestWrapper>['wrapper'];

const renderWithQueryClient = (component: React.ReactElement) => {
  return render(component, { wrapper });
};

describe('CardView', () => {
  const messages = createMessageMock(vi.mocked(sendMessage));
  const seedCards = (cards: Card[]) => {
    setPopupLearningCardsQueryData(queryClient, cards);
  };

  beforeEach(() => {
    messages.reset();
    ({ queryClient, wrapper } = createTestWrapper());
  });

  it('should render loading state without a filter input', () => {
    const pending = Promise.withResolvers<Card[]>();
    vi.spyOn(storage, 'getItem').mockReturnValue(
      pending.promise.then((cards) =>
        buildLearningDocument({ cards: Object.fromEntries(cards.map((card) => [card.slug, card])) })
      )
    );
    const view = renderWithQueryClient(<CardView />);
    expect(screen.getByText('Loading cards...')).toBeInTheDocument();
    expect(screen.queryByPlaceholderText('Filter by name or ID...')).not.toBeInTheDocument();
    view.unmount();
    pending.resolve([]);
  });

  it('should render empty state without a filter input when no cards', () => {
    seedCards([]);

    renderWithQueryClient(<CardView />);
    expect(screen.getByText('No cards added yet.')).toBeInTheDocument();
    expect(screen.queryByPlaceholderText('Filter by name or ID...')).not.toBeInTheDocument();
  });

  it('should render cards sorted by leetcode ID', () => {
    const cards = [
      createMockCard(State.New, { leetcodeId: '42', name: 'Problem 42' }),
      createMockCard(State.New, { leetcodeId: '1', name: 'Problem 1' }),
      createMockCard(State.New, { leetcodeId: '100', name: 'Problem 100' }),
    ];

    seedCards(cards);

    renderWithQueryClient(<CardView />);

    const cardElements = screen.getAllByRole('button');
    expect(within(cardElements[0]).getByText('#1')).toBeInTheDocument();
    expect(within(cardElements[0]).getByText('Problem 1')).toBeInTheDocument();
    expect(within(cardElements[1]).getByText('#42')).toBeInTheDocument();
    expect(within(cardElements[2]).getByText('#100')).toBeInTheDocument();
  });

  it('should display each difficulty', () => {
    const cards = [
      createMockCard(State.New, { difficulty: 'Easy' }),
      createMockCard(State.New, { difficulty: 'Medium' }),
      createMockCard(State.New, { difficulty: 'Hard' }),
    ];

    seedCards(cards);

    renderWithQueryClient(<CardView />);

    const easyCard = screen.getByText('Easy');
    expect(easyCard).toBeInTheDocument();

    const mediumCard = screen.getByText('Medium');
    expect(mediumCard).toBeInTheDocument();

    const hardCard = screen.getByText('Hard');
    expect(hardCard).toBeInTheDocument();
  });

  it('should link cards to their problem on the stored LeetCode domain', () => {
    const cards = [
      createMockCard(State.New, { name: 'Two Sum', slug: 'two-sum', domain: 'leetcode.com' }),
      createMockCard(State.New, { name: 'Chinese Problem', slug: 'chinese-problem', domain: 'leetcode.cn' }),
    ];

    seedCards(cards);

    renderWithQueryClient(<CardView />);

    expect(screen.getByRole('link', { name: 'Open Two Sum on LeetCode' })).toHaveAttribute(
      'href',
      'https://leetcode.com/problems/two-sum/description/'
    );
    expect(screen.getByRole('link', { name: 'Open Chinese Problem on LeetCode' })).toHaveAttribute(
      'href',
      'https://leetcode.cn/problems/chinese-problem/description/'
    );

    for (const link of screen.getAllByRole('link')) {
      expect(link).toHaveAttribute('target', '_blank');
      expect(link).toHaveAttribute('rel', 'noopener noreferrer');
    }
  });

  it('should show pause indicator for paused cards', () => {
    const cards = [
      createMockCard(State.New, { paused: true, name: 'Paused Problem' }),
      createMockCard(State.New, { paused: false, name: 'Active Problem' }),
    ];

    seedCards(cards);

    renderWithQueryClient(<CardView />);

    // Check for pause icon on paused card
    const pausedCard = screen.getByText('Paused Problem').closest('button');
    expect(within(requireDefined(pausedCard)).getByTitle('Card is paused')).toBeInTheDocument();

    // Check no pause icon on active card
    const activeCard = screen.getByText('Active Problem').closest('button');
    expect(within(requireDefined(activeCard)).queryByTitle('Card is paused')).not.toBeInTheDocument();
  });

  it('should expand and collapse card details', () => {
    const card = createMockCard(State.Learning, {
      name: 'Test Problem',
      fsrs: {
        state: State.Learning,
        due: new Date('2024-01-01').getTime(),
        stability: 2.5,
        difficulty: 1.3,
        elapsed_days: 0,
        scheduled_days: 0,
        reps: 5,
        lapses: 1,
        last_review: new Date('2023-12-31').getTime(),
        learning_steps: 0,
      },
    });

    seedCards([card]);

    renderWithQueryClient(<CardView />);

    // Initially, stats should not be visible
    expect(screen.queryByText('State:')).not.toBeInTheDocument();

    // Click to expand
    const cardButton = screen.getByRole('button');
    fireEvent.click(cardButton);

    // Stats should now be visible
    expect(screen.getByText('State:')).toBeInTheDocument();
    expect(screen.getByText('Learning')).toBeInTheDocument();
    expect(screen.getByText('Reviews:')).toBeInTheDocument();
    // Use more specific query to avoid conflict with streak counter
    const reviewsRow = screen.getByText('Reviews:').parentElement;
    expect(within(requireDefined(reviewsRow)).getByText('5')).toBeInTheDocument();
    expect(screen.getByText('Stability:')).toBeInTheDocument();
    expect(screen.getByText('2.5d')).toBeInTheDocument();
    expect(screen.getByText('Lapses:')).toBeInTheDocument();
    const lapsesRow = screen.getByText('Lapses:').parentElement;
    expect(within(requireDefined(lapsesRow)).getByText('1')).toBeInTheDocument();

    // Click to collapse
    fireEvent.click(cardButton);
    expect(screen.queryByText('State:')).not.toBeInTheDocument();
  });

  it('should handle multiple cards expanded simultaneously', () => {
    const cards = [
      createMockCard(State.New, { id: 'problem-1', name: 'Problem 1', leetcodeId: '1' }),
      createMockCard(State.New, { id: 'problem-2', name: 'Problem 2', leetcodeId: '2' }),
    ];

    seedCards(cards);

    renderWithQueryClient(<CardView />);

    const cardButtons = screen.getAllByRole('button');

    // Expand first card
    fireEvent.click(cardButtons[0]);
    expect(screen.getAllByText('State:').length).toBe(1);

    // Expand second card
    fireEvent.click(cardButtons[1]);
    expect(screen.getAllByText('State:').length).toBe(2);

    // Collapse first card
    fireEvent.click(cardButtons[0]);
    expect(screen.getAllByText('State:').length).toBe(1);
  });

  it('should format dates correctly', () => {
    const card = createMockCard(State.Review, {
      createdAt: new Date('2024-01-15T12:00:00Z').getTime(),
      fsrs: {
        state: State.Review,
        due: new Date('2024-02-01T12:00:00Z').getTime(),
        stability: 1,
        difficulty: 1,
        elapsed_days: 0,
        scheduled_days: 0,
        reps: 1,
        lapses: 0,
        last_review: new Date('2024-01-20T12:00:00Z').getTime(),
        learning_steps: 0,
      },
    });

    seedCards([card]);

    renderWithQueryClient(<CardView />);

    // Expand card
    fireEvent.click(screen.getByRole('button'));

    // Check that the dates are present (just check that they're formatted, not exact values due to timezone)
    const addedRow = screen.getByText('Added:').parentElement;
    expect(within(requireDefined(addedRow)).getByText(/\w{3} \d{1,2}, \d{4}/)).toBeInTheDocument();

    const dueRow = screen.getByText('Due:').parentElement;
    expect(within(requireDefined(dueRow)).getByText(/\w{3} \d{1,2}, \d{4}/)).toBeInTheDocument();

    const lastRow = screen.getByText('Last:').parentElement;
    expect(within(requireDefined(lastRow)).getByText(/\w{3} \d{1,2}, \d{4}/)).toBeInTheDocument();
  });

  it('should show all FSRS states correctly', () => {
    const cards = [
      createMockCard(State.New, { name: 'New Card' }),
      createMockCard(State.Learning, { name: 'Learning Card' }),
      createMockCard(State.Review, { name: 'Review Card' }),
      createMockCard(State.Relearning, { name: 'Relearning Card' }),
    ];

    seedCards(cards);

    renderWithQueryClient(<CardView />);

    // Verify all cards are rendered
    expect(screen.getByText('New Card')).toBeInTheDocument();
    expect(screen.getByText('Learning Card')).toBeInTheDocument();
    expect(screen.getByText('Review Card')).toBeInTheDocument();
    expect(screen.getByText('Relearning Card')).toBeInTheDocument();
  });

  it('should filter cards, show no matches, and restore all cards when cleared', () => {
    const cards = [
      createMockCard(State.New, { name: 'Two Sum', leetcodeId: '1' }),
      createMockCard(State.New, { name: 'Add Two Numbers', leetcodeId: '2' }),
      createMockCard(State.New, { name: 'Longest Substring', leetcodeId: '3' }),
    ];

    seedCards(cards);

    renderWithQueryClient(<CardView />);

    expect(screen.getByText('Two Sum')).toBeInTheDocument();
    expect(screen.getByText('Add Two Numbers')).toBeInTheDocument();
    expect(screen.getByText('Longest Substring')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Clear filter' })).not.toBeInTheDocument();

    const filterInput = screen.getByPlaceholderText('Filter by name or ID...');
    fireEvent.change(filterInput, { target: { value: 'Two' } });

    expect(screen.getByText('Two Sum')).toBeInTheDocument();
    expect(screen.getByText('Add Two Numbers')).toBeInTheDocument();
    expect(screen.queryByText('Longest Substring')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Clear filter' })).toBeInTheDocument();

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
    expect(screen.queryByRole('button', { name: 'Clear filter' })).not.toBeInTheDocument();
  });
});
