import { initializeCatalog } from '@/shared/catalog';
import { setPopupLearningCardsQueryData } from '@/test/utils/learning-document-mocks';
/**
 * @vitest-environment happy-dom
 */

import type { QueryClient } from '@tanstack/react-query';
import { fireEvent, render, screen } from '@testing-library/react';
import { State } from 'ts-fsrs';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { CardWithQuestion } from '@/popup/queries/cards';
import { sendMessage } from '@/shared/messages';
import { createMockCardWithQuestion } from '@/test/utils/card-mocks';
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
  const seedCards = (cards: CardWithQuestion[]) => {
    setPopupLearningCardsQueryData(queryClient, cards);
  };

  beforeEach(() => {
    messages.reset().resolve('waitForInitialization', undefined);
    ({ queryClient, wrapper } = createTestWrapper());
  });

  it('should link cards to their problem on the stored LeetCode domain', () => {
    const cards = [
      createMockCardWithQuestion(State.New, { title: 'Two Sum', slug: 'two-sum', domain: 'leetcode.com' }),
      createMockCardWithQuestion(State.New, {
        title: 'Chinese Problem',
        translatedTitle: '中文题目',
        slug: 'chinese-problem',
        domain: 'leetcode.cn',
      }),
    ];

    seedCards(cards);

    renderWithQueryClient(<CardView />);

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
      createMockCardWithQuestion(State.New, { title: 'Two Sum', frontendId: '1' }),
      createMockCardWithQuestion(State.New, { title: 'Add Two Numbers', frontendId: '2' }),
      createMockCardWithQuestion(State.New, { title: 'Longest Substring', frontendId: '3' }),
    ];

    seedCards(cards);

    renderWithQueryClient(<CardView />);

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
