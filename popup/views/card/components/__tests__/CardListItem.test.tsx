/**
 * @vitest-environment happy-dom
 */

import { act, fireEvent, render, screen } from '@testing-library/react';
import { State } from 'ts-fsrs';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { CardWithProblem } from '@/popup/queries/cards';
import { background } from '@/shared/background-service';
import { createMockCardWithProblem } from '@/test/utils/card-mocks';
import { setPopupLearningCardsQueryData } from '@/test/utils/learning-document-mocks';
import { createServiceMock } from '@/test/utils/service-mocks';
import { createTestWrapper } from '@/test/utils/test-wrapper';
import { CardListItem } from '../CardListItem';

vi.mock('@/shared/background-service');
vi.mock('@/popup/components/notes/NoteEditor', () => ({ NoteEditor: () => null }));

const service = createServiceMock(background);
let wrapper: ReturnType<typeof createTestWrapper>['wrapper'];

const NOW = Date.parse('2024-02-01T12:00:00-08:00');

const renderItem = (card: CardWithProblem) => {
  render(<CardListItem card={card} now={NOW} />, { wrapper });
  fireEvent.click(screen.getByRole('button', { expanded: false }));
};

describe('CardListItem', () => {
  beforeEach(() => {
    service.reset().resolve('setPauseStatus', undefined).resolve('removeCard', undefined);
    const test = createTestWrapper();
    wrapper = test.wrapper;
    // Expanded cards read the display language from settings.
    setPopupLearningCardsQueryData(test.queryClient, []);
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it.each([0, undefined])('renders review facts with last_review=%s', (lastReview) => {
    const card = createMockCardWithProblem(State.Review, { createdAt: Date.parse('2024-01-02T12:00:00-08:00') });
    card.fsrs.due = Date.parse('2024-02-03T12:00:00-08:00');
    if (lastReview === undefined) {
      delete card.fsrs.last_review;
    } else {
      card.fsrs.last_review = lastReview;
    }
    renderItem(card);

    expect(screen.getByText('Next review').parentElement).toHaveTextContent('Next reviewFeb 3');
    expect(screen.getByText('Added Jan 2', { exact: false })).toBeInTheDocument();
    // The grid keeps its slot when a card has never been reviewed.
    expect(screen.getByText('Last review').parentElement).toHaveTextContent(
      lastReview === undefined ? 'Last review—Never' : 'Last reviewDec 31, 1969'
    );
  });

  it('expires delete confirmation', () => {
    vi.useFakeTimers();
    renderItem(createMockCardWithProblem(State.New));

    fireEvent.click(screen.getByRole('button', { name: 'Delete card' }));
    expect(screen.getByRole('button', { name: 'Confirm Delete?' })).toBeInTheDocument();

    act(() => vi.advanceTimersByTime(3000));

    expect(screen.getByRole('button', { name: 'Delete card' })).toBeInTheDocument();
    expect(background.removeCard).not.toHaveBeenCalledWith(expect.anything());
  });

  it('keeps overlapping operations on different cards independent', async () => {
    const pauseResult = Promise.withResolvers<void>();
    const deleteResult = Promise.withResolvers<void>();
    service.handle('setPauseStatus', () => pauseResult.promise).handle('removeCard', () => deleteResult.promise);
    const cards = [
      createMockCardWithProblem(State.New, { frontendId: 'first', title: 'First', slug: 'first' }),
      createMockCardWithProblem(State.New, { frontendId: 'second', title: 'Second', slug: 'second' }),
    ];

    render(
      cards.map((card) => <CardListItem key={card.frontendId} card={card} now={NOW} />),
      { wrapper }
    );

    for (const toggle of screen.getAllByRole('button', { expanded: false })) fireEvent.click(toggle);
    const pauseButtons = screen.getAllByRole('button', { name: 'Pause' });
    const deleteButtons = screen.getAllByRole('button', { name: 'Delete card' });
    fireEvent.click(pauseButtons[0]);
    fireEvent.click(deleteButtons[1]);
    fireEvent.click(screen.getByRole('button', { name: 'Confirm Delete?' }));

    await vi.waitFor(() => {
      expect(pauseButtons[0]).toBeDisabled();
      expect(pauseButtons[1]).not.toBeDisabled();
      expect(deleteButtons[0]).not.toBeDisabled();
      expect(deleteButtons[1]).toBeDisabled();
    });
    expect(background.setPauseStatus).toHaveBeenCalledExactlyOnceWith('first', true);
    expect(background.removeCard).toHaveBeenCalledExactlyOnceWith('second');

    await act(async () => {
      pauseResult.resolve();
      deleteResult.resolve();
      await Promise.all([pauseResult.promise, deleteResult.promise]);
    });
  });
});
