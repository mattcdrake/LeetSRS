/**
 * @vitest-environment happy-dom
 */

import { act, fireEvent, render, screen } from '@testing-library/react';
import { State } from 'ts-fsrs';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { CardWithProblem } from '@/popup/queries/cards';
import { background } from '@/shared/background-service';
import { createMockCardWithProblem } from '@/test/utils/card-mocks';
import { createServiceMock } from '@/test/utils/service-mocks';
import { createTestWrapper } from '@/test/utils/test-wrapper';
import { CardListItem } from '../CardListItem';

vi.mock('@/shared/background-service');
vi.mock('@/popup/components/notes/NoteEditor', () => ({ NoteEditor: () => null }));

const service = createServiceMock(background);
let wrapper: ReturnType<typeof createTestWrapper>['wrapper'];

const renderItem = (card: CardWithProblem) => {
  render(<CardListItem card={card} />, { wrapper });
  fireEvent.click(screen.getByRole('button', { expanded: false }));
};

describe('CardListItem', () => {
  it.each([undefined, 'https://www.youtube.com/watch?v=KLlXCFG5TnA'])(
    'keeps the optional video link outside the card expansion control (%s)',
    (youtubeUrl) => {
      render(<CardListItem card={createMockCardWithProblem(State.New, { youtubeUrl })} />, { wrapper });
      const link = screen.queryByRole('link', { name: 'Watch NeetCode solution on YouTube' });
      if (youtubeUrl) {
        expect(link).toHaveAttribute('href', youtubeUrl);
        const videoLink = screen.getByRole('link', { name: 'Watch NeetCode solution on YouTube' });
        videoLink.addEventListener('click', (event) => event.preventDefault(), { once: true });
        fireEvent.click(videoLink);
      } else {
        expect(link).not.toBeInTheDocument();
      }
      expect(screen.getByRole('button', { expanded: false })).toBeInTheDocument();
      expect(background.setPauseStatus).not.toHaveBeenCalled();
      expect(background.removeCard).not.toHaveBeenCalled();
    }
  );

  beforeEach(() => {
    service.reset().resolve('setPauseStatus', undefined).resolve('removeCard', undefined);
    wrapper = createTestWrapper().wrapper;
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it.each([0, undefined])('renders numeric dates with last_review=%s', (lastReview) => {
    const card = createMockCardWithProblem(State.Review, { createdAt: Date.parse('2024-01-02T12:00:00-08:00') });
    card.fsrs.due = Date.parse('2024-02-03T12:00:00-08:00');
    if (lastReview === undefined) {
      delete card.fsrs.last_review;
    } else {
      card.fsrs.last_review = lastReview;
    }
    renderItem(card);

    expect(screen.getByText('Due:').parentElement).toHaveTextContent('Due:Feb 3, 2024');
    expect(screen.getByText('Added:').parentElement).toHaveTextContent('Added:Jan 2, 2024');
    if (lastReview === undefined) {
      expect(screen.queryByText('Last:')).not.toBeInTheDocument();
    } else {
      expect(screen.getByText('Last:').parentElement).toHaveTextContent('Last:Dec 31, 1969');
    }
  });

  it('expires delete confirmation', () => {
    vi.useFakeTimers();
    renderItem(createMockCardWithProblem(State.New));

    fireEvent.click(screen.getByRole('button', { name: 'Delete' }));
    expect(screen.getByRole('button', { name: 'Confirm?' })).toBeInTheDocument();

    act(() => vi.advanceTimersByTime(3000));

    expect(screen.getByRole('button', { name: 'Delete' })).toBeInTheDocument();
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
      cards.map((card) => <CardListItem key={card.frontendId} card={card} />),
      { wrapper }
    );

    for (const toggle of screen.getAllByRole('button', { expanded: false })) fireEvent.click(toggle);
    const pauseButtons = screen.getAllByRole('button', { name: 'Pause' });
    const deleteButtons = screen.getAllByRole('button', { name: 'Delete' });
    fireEvent.click(pauseButtons[0]);
    fireEvent.click(deleteButtons[1]);
    fireEvent.click(screen.getByRole('button', { name: 'Confirm?' }));

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
