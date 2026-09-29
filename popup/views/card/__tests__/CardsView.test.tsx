/** @vitest-environment happy-dom */
import { fireEvent, render, screen } from '@testing-library/react';
import { State } from 'ts-fsrs';
import { expect, it, vi } from 'vitest';
import { replaceLearningDocument } from '@/shared/learning-document';
import { createMockCard } from '@/test/utils/card-mocks';
import { buildLearningDocument } from '@/test/utils/learning-document-mocks';
import { createPopupTestWrapper } from '@/test/utils/test-wrapper';
import { CardsView } from '../CardsView';

vi.mock('@/shared/background-service');

it('combines search and filters while keeping counts independent, and clears both', async () => {
  const newCard = createMockCard(State.New);
  const review = createMockCard(State.Review, { frontendId: '2' });
  const future = createMockCard(State.New, { frontendId: '3' });
  future.fsrs.due = Date.now() + 30 * 86_400_000;
  await replaceLearningDocument(buildLearningDocument({ cards: { 1: newCard, 2: review, 3: future } }));
  render(<CardsView onBrowseRoadmaps={vi.fn()} />, { wrapper: createPopupTestWrapper().wrapper });

  fireEvent.click(await screen.findByRole('button', { name: 'Due 2' }));
  fireEvent.click(screen.getByRole('button', { name: 'New 2' }));
  expect(screen.getByText('1 of 3')).toBeInTheDocument();
  expect(screen.getByText('Two Sum')).toBeInTheDocument();
  expect(screen.queryByText('Add Two Numbers')).not.toBeInTheDocument();
  fireEvent.change(screen.getByRole('textbox'), { target: { value: 'missing' } });
  expect(screen.getByText('No matching cards')).toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'Clear filters' }));
  expect(screen.getByRole('textbox')).toHaveValue('');
  expect(screen.getByText('3 cards')).toBeInTheDocument();
  expect(screen.getByText('Add Two Numbers')).toBeInTheDocument();
});
