import { storage } from '#imports';
import { initializeCatalog } from '@/shared/catalog';
import { buildLearningDocument, setPopupLearningCardsQueryData } from '@/test/utils/learning-document-mocks';
/**
 * @vitest-environment happy-dom
 */

import type { QueryClient } from '@tanstack/react-query';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { State } from 'ts-fsrs';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { CardWithProblem } from '@/popup/queries/cards';
import { background } from '@/shared/background-service';
import type { Card } from '@/shared/models';
import { createMockCardWithProblem } from '@/test/utils/card-mocks';
import { createServiceMock } from '@/test/utils/service-mocks';
import { createPopupTestWrapper } from '@/test/utils/test-wrapper';
import { ReviewQueue } from '../ReviewQueue';

vi.mock('@/shared/background-service');

describe('ReviewQueue', () => {
  const mockCards = [
    createMockCardWithProblem(State.Learning, {
      slug: 'two-sum',
      title: 'Two Sum',
      frontendId: '1',
      difficulty: 'easy',
    }),
    createMockCardWithProblem(State.Learning, {
      slug: 'add-two-numbers',
      title: 'Add Two Numbers',
      frontendId: '2',
      difficulty: 'medium',
    }),
    createMockCardWithProblem(State.Learning, {
      slug: 'longest-substring',
      title: 'Longest Substring',
      frontendId: '3',
      difficulty: 'medium',
    }),
  ];

  const mockMutateAsync = vi.fn();
  const service = createServiceMock(background);
  let wrapper: React.ComponentType<{ children: React.ReactNode }>;
  let queryClient: QueryClient;
  const seedQueue = (cards: CardWithProblem[]) => {
    vi.mocked(storage.getItem).mockResolvedValue(
      buildLearningDocument({ cards: Object.fromEntries(cards.map((card) => [card.frontendId, card])) })
    );
    setPopupLearningCardsQueryData(queryClient, cards);
  };
  const waitForInitialQueueRefresh = async () => {
    await waitFor(() => {
      // The storage observer schedules its initial fetch asynchronously.
      expect(background.waitForInitialization).toHaveBeenCalledWith();
      expect(queryClient.isFetching()).toBe(0);
    });
  };

  beforeEach(() => {
    vi.spyOn(storage, 'getItem');
    service
      .reset()
      .resolve('waitForInitialization', undefined)
      .handle('rateCard', mockMutateAsync)
      .resolve('removeCard', undefined)
      .resolve('delayCard', undefined)
      .resolve('setPauseStatus', undefined);
    mockMutateAsync.mockReset();

    ({ wrapper, queryClient } = createPopupTestWrapper());
    mockCards.forEach((card, index) => {
      card.fsrs.due = index;
    });
    seedQueue(mockCards);
    mockMutateAsync.mockResolvedValue(undefined);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('Processing State', () => {
    it('keeps controls disabled after the command until the queue refresh completes', async () => {
      const mutation = Promise.withResolvers<void>();
      const refresh = Promise.withResolvers<ReturnType<typeof buildLearningDocument>>();
      mockMutateAsync.mockReturnValue(mutation.promise);
      render(<ReviewQueue />, { wrapper });

      await waitForInitialQueueRefresh();
      const goodButton = await screen.findByRole('button', { name: 'Good' });
      vi.mocked(storage.getItem).mockReturnValue(refresh.promise);
      fireEvent.click(goodButton);
      mutation.resolve();
      await act(async () => Promise.resolve());
      expect(goodButton).toBeDisabled();
      expect(screen.getByText('Two Sum')).toBeInTheDocument();

      refresh.resolve(
        buildLearningDocument({ cards: Object.fromEntries(mockCards.slice(1).map((card) => [card.frontendId, card])) })
      );
      await waitFor(() => expect(screen.getByText('Add Two Numbers')).toBeInTheDocument());
      expect(screen.getByRole('button', { name: 'Good' })).toBeEnabled();
    });

    it('does not render a cache update until the command also completes', async () => {
      const mutation = Promise.withResolvers<void>();
      mockMutateAsync.mockReturnValue(mutation.promise);
      render(<ReviewQueue />, { wrapper });

      await waitForInitialQueueRefresh();
      fireEvent.click(await screen.findByRole('button', { name: 'Good' }));
      await act(async () => seedQueue(mockCards.slice(1)));

      await waitFor(() => expect(screen.getByText('Loading review queue...')).toBeInTheDocument());
      expect(screen.queryByText('Two Sum')).not.toBeInTheDocument();
      expect(screen.queryByText('Add Two Numbers')).not.toBeInTheDocument();
      expect(screen.queryByRole('button', { name: 'Actions' })).not.toBeInTheDocument();

      mutation.resolve();

      await waitFor(() => expect(screen.getByText('Add Two Numbers')).toBeInTheDocument());
      expect(screen.getByRole('button', { name: 'Good' })).not.toBeDisabled();
      expect(screen.getByRole('button', { name: 'Actions' })).not.toBeDisabled();
    });
  });

  describe('Card Actions', () => {
    it('should disable controls and prevent duplicate actions while a review is pending', async () => {
      const mutation = Promise.withResolvers<Card>();
      service.handle('rateCard', () => mutation.promise);
      render(<ReviewQueue />, { wrapper });

      const actionButton = await screen.findByRole('button', { name: 'Good' });
      fireEvent.click(screen.getByRole('button', { name: 'Notes' }));
      fireEvent.change(screen.getByRole('textbox'), { target: { value: 'Draft' } });
      fireEvent.click(screen.getByRole('button', { name: 'Actions' }));
      const controls = screen.getAllByRole('button');
      for (const control of controls) expect(control).toBeEnabled();

      for (const method of Object.values(background)) vi.mocked(method).mockClear();
      fireEvent.click(actionButton);
      for (const control of controls) fireEvent.click(control);
      fireEvent.click(actionButton);

      await waitFor(() => expect(vi.mocked(background.rateCard).mock.calls).toHaveLength(1));
      expect(background.rateCard).toHaveBeenCalledWith(expect.any(Object));
      for (const control of controls) expect(control).toBeDisabled();
      expect(screen.getByRole('textbox')).toBeDisabled();

      mutation.resolve(createMockCardWithProblem(State.Review));
      await waitFor(() => {
        for (const control of controls) expect(control).toBeEnabled();
      });
      expect(vi.mocked(background.rateCard).mock.calls).toHaveLength(1);
    });
  });
});

beforeEach(initializeCatalog);
