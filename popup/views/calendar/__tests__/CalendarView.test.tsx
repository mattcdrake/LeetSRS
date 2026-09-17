/** @vitest-environment happy-dom */
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { State } from 'ts-fsrs';
import { beforeEach, expect, it, vi } from 'vitest';
import { fakeBrowser } from 'wxt/testing/fake-browser';
import { I18nProvider } from '@/popup/contexts/I18nContext';
import { replaceLearningDocument } from '@/shared/storage';
import { createMockCard } from '@/test/utils/card-mocks';
import { buildLearningDocument } from '@/test/utils/learning-document-mocks';
import { createPopupTestWrapper } from '@/test/utils/test-wrapper';
import { CalendarView } from '../CalendarView';

vi.mock('@/shared/background-service');

beforeEach(() => {
  fakeBrowser.reset();
  vi.spyOn(Date, 'now').mockReturnValue(new Date(2026, 8, 17, 12).getTime());
});

async function openCalendar(document = buildLearningDocument()) {
  await replaceLearningDocument(document);
  const { wrapper } = createPopupTestWrapper();
  render(
    <I18nProvider>
      <CalendarView />
    </I18nProvider>,
    { wrapper }
  );
  await screen.findByRole('grid', { name: 'Calendar, September 2026' });
}

function day(name: string) {
  return screen.getByRole('button', { name: new RegExp(name) });
}

it('starts on today, keeps due counts visible on selection, and allows empty days', async () => {
  const card = createMockCard(State.Review);
  const futureCard = createMockCard(State.Review, {
    frontendId: '2',
    fsrs: { ...card.fsrs, due: new Date(2026, 8, 18, 12).getTime() },
  });
  await openCalendar(buildLearningDocument({ cards: { '1': card, '2': futureCard } }));

  expect(day('September 17, 2026')).toHaveAttribute('data-selected');
  expect(day('September 17, 2026')).toHaveAccessibleName(/1 due$/);
  expect(await screen.findByRole('link', { name: '1. Two Sum' })).toHaveAttribute(
    'href',
    'https://leetcode.com/problems/two-sum/description/'
  );
  expect(screen.getByRole('region')).toHaveTextContent('1 due · 1 overdue');
  expect(day('September 16, 2026')).toHaveAttribute('aria-disabled', 'true');
  fireEvent.click(day('September 16, 2026'));
  expect(day('September 17, 2026')).toHaveAttribute('data-selected');

  fireEvent.click(day('September 18, 2026'));
  expect(day('September 18, 2026')).toHaveAttribute('data-selected');
  expect(within(day('September 18, 2026')).getByText('1 due')).toBeVisible();
  expect(await screen.findByRole('link', { name: '2. Add Two Numbers' })).toBeVisible();
  expect(screen.queryByRole('link', { name: '1. Two Sum' })).not.toBeInTheDocument();
  expect(screen.queryByText(/overdue/)).not.toBeInTheDocument();
  fireEvent.click(day('September 19, 2026'));
  expect(day('September 19, 2026')).toHaveAttribute('data-selected');
  expect(day('September 19, 2026')).not.toHaveAttribute('data-has-due');
  expect(screen.getByText('No problems due on this day.')).toBeVisible();
  expect(screen.queryByRole('list')).not.toBeInTheDocument();
});

it('returns to today after selecting a date in another month', async () => {
  await openCalendar();
  fireEvent.click(screen.getByRole('button', { name: 'Next month' }));
  fireEvent.click(day('October 20, 2026'));
  fireEvent.click(screen.getByRole('button', { name: 'Today' }));
  expect(screen.getByRole('grid', { name: 'Calendar, September 2026' })).toBeInTheDocument();
  expect(day('September 17, 2026')).toHaveAttribute('data-selected');
});

it('refreshes projected counts after learning document changes', async () => {
  const card = createMockCard(State.New);
  const document = buildLearningDocument({
    cards: { '1': card, '2': { ...card, frontendId: '2' } },
    settings: { maxNewCardsPerDay: 1 },
  });
  await openCalendar(document);
  expect(day('September 17, 2026')).toHaveAccessibleName(/1 due$/);
  expect(day('September 18, 2026')).toHaveAccessibleName(/1 due$/);
  expect(await screen.findByRole('link', { name: '1. Two Sum' })).toBeVisible();

  await act(async () => {
    await replaceLearningDocument({
      ...document,
      reviewActivity: { date: '2026-09-17', newCards: 1, streak: 0 },
    });
  });
  await waitFor(() => expect(day('September 17, 2026')).toHaveAccessibleName(/0 due$/));
  expect(day('September 18, 2026')).toHaveAccessibleName(/1 due$/);
  expect(day('September 19, 2026')).toHaveAccessibleName(/1 due$/);
  expect(screen.getByText('No problems due on this day.')).toBeVisible();
  expect(screen.queryByRole('link')).not.toBeInTheDocument();
  fireEvent.click(day('September 18, 2026'));
  expect(await screen.findByRole('link', { name: '1. Two Sum' })).toBeVisible();
  expect(screen.queryByText(/overdue/)).not.toBeInTheDocument();
});

it('lists eligible problems in due order with difficulty, excluding paused and excess new cards', async () => {
  const review = createMockCard(State.Review);
  const newCard = createMockCard(State.New);
  await openCalendar(
    buildLearningDocument({
      cards: {
        '1': { ...review, fsrs: { ...review.fsrs, due: new Date(2026, 8, 17, 15).getTime() } },
        '2': { ...newCard, frontendId: '2', fsrs: { ...newCard.fsrs, due: new Date(2026, 8, 16, 12).getTime() } },
        '3': { ...newCard, frontendId: '3', fsrs: { ...newCard.fsrs, due: new Date(2026, 8, 17, 10).getTime() } },
        paused: { ...review, frontendId: 'paused', paused: true },
      },
      settings: { maxNewCardsPerDay: 1 },
    })
  );

  const list = await screen.findByRole('list');
  const rows = within(list).getAllByRole('listitem');
  expect(rows).toHaveLength(2);
  expect(within(rows[0]).getByRole('link', { name: '2. Add Two Numbers' })).toBeVisible();
  expect(within(rows[0]).getByText('medium')).toBeVisible();
  expect(within(rows[1]).getByRole('link', { name: '1. Two Sum' })).toBeVisible();
  expect(within(rows[1]).getByText('easy')).toBeVisible();
  expect(day('September 17, 2026')).toHaveAccessibleName(/2 due$/);
  expect(screen.getByRole('region')).toHaveTextContent('2 due · 1 overdue');

  fireEvent.click(day('September 18, 2026'));
  expect(await screen.findByRole('link', { name: '3. Longest Substring' })).toBeVisible();
  expect(screen.getAllByRole('listitem')).toHaveLength(1);
});

it('uses the problem domain and translated title without authorizing an editor reset', async () => {
  await openCalendar(
    buildLearningDocument({
      cards: { '1': createMockCard(State.Review, { domain: 'leetcode.cn' }) },
      settings: { resetEditorOnReviewQueue: true },
    })
  );
  const link = await screen.findByRole('link', { name: '1. 两数之和' });
  expect(link).toHaveAttribute('href', 'https://leetcode.cn/problems/two-sum/description/');
  expect(link).toHaveAttribute('target', '_blank');
});

it('keeps the selected day detail aligned with the calendar after midnight', async () => {
  const card = createMockCard(State.Review);
  await openCalendar(buildLearningDocument({ cards: { '1': card } }));
  expect(await screen.findByRole('link', { name: '1. Two Sum' })).toBeVisible();

  vi.spyOn(Date, 'now').mockReturnValue(new Date(2026, 8, 18, 0, 1).getTime());
  fireEvent.focus(window);

  expect(day('September 18, 2026')).toHaveAttribute('data-selected');
  expect(screen.getByRole('heading', { name: 'Fri, Sep 18, 2026' })).toBeVisible();
  expect(await screen.findByRole('link', { name: '1. Two Sum' })).toBeVisible();
  expect(screen.getByRole('region')).toHaveTextContent('1 due · 1 overdue');
});
