import { initializeCatalog } from '@/shared/catalog';
import { setPopupLearningCardsQueryData } from '@/test/utils/learning-document-mocks';
/**
 * @vitest-environment happy-dom
 */

import type { QueryClient } from '@tanstack/react-query';
import { fireEvent, render, screen } from '@testing-library/react';
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

  it('combines search and filter toggles, preserves visible expansion, and resets on remount', () => {
    seedCards([
      createMockCardWithProblem(State.New, { title: 'Paused new', frontendId: '1', paused: true }),
      createMockCardWithProblem(State.New, { title: 'Active new', frontendId: '2' }),
      createMockCardWithProblem(State.Review, { title: 'Paused review', frontendId: '3', paused: true }),
    ]);
    const view = renderWithQueryClient(<CardsView />);
    const search = screen.getByRole('textbox');
    expect(screen.queryByRole('button', { name: 'Clear filter' })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /Paused new/ }));
    expect(screen.getByRole('button', { name: /Active new/ })).toHaveAttribute('aria-expanded', 'false');
    fireEvent.change(search, { target: { value: 'new' } });
    expect(screen.getByText('Paused new')).toBeInTheDocument();
    expect(screen.getByText('Active new')).toBeInTheDocument();
    expect(screen.queryByText('Paused review')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Paused new/ })).toHaveAttribute('aria-expanded', 'true');
    fireEvent.click(screen.getByRole('button', { name: 'Clear filter' }));
    expect(search).toHaveValue('');
    expect(screen.getByText('Paused review')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Clear filter' })).not.toBeInTheDocument();
    for (const name of ['Due', 'New', 'Paused']) {
      const button = screen.getByRole('button', { name });
      fireEvent.click(button);
      expect(button).toHaveAttribute('aria-pressed', 'true');
    }
    expect(screen.getByText('Paused new')).toBeInTheDocument();
    expect(screen.queryByText('Active new')).not.toBeInTheDocument();
    expect(screen.queryByText('Paused review')).not.toBeInTheDocument();
    fireEvent.change(search, { target: { value: 'review' } });
    expect(screen.getByText('No cards match your filter.')).toBeInTheDocument();
    expect(screen.queryByText('No cards added yet.')).not.toBeInTheDocument();
    expect(search).toHaveValue('review');
    fireEvent.click(screen.getByRole('button', { name: 'Clear filter' }));
    expect(screen.getByRole('button', { name: /Paused new/ })).toHaveAttribute('aria-expanded', 'false');
    fireEvent.change(search, { target: { value: 'review' } });
    fireEvent.click(screen.getByRole('button', { name: 'New' }));
    expect(screen.getByRole('button', { name: 'New' })).toHaveAttribute('aria-pressed', 'false');
    expect(screen.getByText('Paused review')).toBeInTheDocument();
    view.rerender(<div />);
    view.rerender(<CardsView />);
    expect(screen.getByRole('textbox')).toHaveValue('');
    for (const name of ['Due', 'New', 'Paused']) {
      expect(screen.getByRole('button', { name })).toHaveAttribute('aria-pressed', 'false');
    }
    expect(screen.getByText('Active new')).toBeInTheDocument();
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
});

beforeEach(initializeCatalog);
