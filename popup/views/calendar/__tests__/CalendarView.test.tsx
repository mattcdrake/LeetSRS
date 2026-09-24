/** @vitest-environment happy-dom */
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { State } from 'ts-fsrs';
import { beforeEach, expect, it, vi } from 'vitest';
import { fakeBrowser } from 'wxt/testing/fake-browser';
import { I18nProvider } from '@/popup/contexts/I18nContext';
import { replaceLearningDocument } from '@/shared/learning-document';
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

it('shows the selected day’s ordered problems, links, counts, and empty state', async () => {
  const card = createMockCard(State.Review);
  await openCalendar(
    buildLearningDocument({
      cards: {
        '1': { ...card, domain: 'leetcode.cn', fsrs: { ...card.fsrs, due: new Date(2026, 8, 17, 15).getTime() } },
        '2': { ...card, frontendId: '2', fsrs: { ...card.fsrs, due: new Date(2026, 8, 16, 9).getTime() } },
        '3': { ...card, frontendId: '3', fsrs: { ...card.fsrs, due: new Date(2026, 8, 18, 12).getTime() } },
      },
    })
  );

  const list = await screen.findByRole('list');
  const links = within(list).getAllByRole('link', { name: /^\d+\./ });
  expect(links).toHaveLength(2);
  expect(links[0]).toHaveAccessibleName('2. Add Two Numbers');
  expect(links[1]).toHaveAccessibleName('1. 两数之和');
  expect(links[1]).toHaveAttribute('href', 'https://leetcode.cn/problems/two-sum/description/');
  expect(links[1]).toHaveAttribute('target', '_blank');
  expect(day('September 17, 2026')).toHaveAttribute('data-selected');
  expect(day('September 17, 2026')).toHaveAccessibleName(/2 due$/);
  expect(screen.getByRole('region')).toHaveTextContent('2 due · 1 overdue');
  expect(day('September 16, 2026')).toHaveAttribute('aria-disabled', 'true');

  fireEvent.click(day('September 18, 2026'));
  expect(await screen.findByRole('link', { name: /3\. Longest Substring/ })).toHaveAttribute(
    'href',
    'https://leetcode.com/problems/longest-substring/description/'
  );
  expect(screen.getAllByRole('link', { name: /^\d+\./ })).toHaveLength(1);
  expect(within(day('September 18, 2026')).getByText('1 due')).toBeVisible();
  expect(screen.getByRole('region')).not.toHaveTextContent('overdue');

  fireEvent.click(day('September 19, 2026'));
  expect(screen.getByRole('region')).toHaveTextContent('0 due');
  expect(screen.getByText('No problems due on this day.')).toBeVisible();
  expect(screen.queryByRole('link')).not.toBeInTheDocument();
});

it('returns both the visible month and day detail to today', async () => {
  await openCalendar();
  fireEvent.click(screen.getByRole('button', { name: 'Next month' }));
  fireEvent.click(day('October 20, 2026'));
  fireEvent.click(screen.getByRole('button', { name: 'Today' }));
  expect(screen.getByRole('grid', { name: 'Calendar, September 2026' })).toBeInTheDocument();
  expect(screen.getByRole('region', { name: 'Thu, Sep 17, 2026' })).toBeVisible();
});

it('updates counts and problems when a review consumes today’s new-card allowance', async () => {
  const card = createMockCard(State.New);
  const document = buildLearningDocument({
    cards: { '1': card, '2': { ...card, frontendId: '2' } },
    settings: { maxNewCardsPerDay: 1 },
  });
  await openCalendar(document);
  expect(day('September 17, 2026')).toHaveAccessibleName(/1 due$/);
  expect(await screen.findByRole('link', { name: /1\. Two Sum/ })).toBeVisible();
  expect(screen.getAllByRole('link', { name: /^\d+\./ })).toHaveLength(1);

  await act(async () => {
    await replaceLearningDocument({
      ...document,
      cards: {
        ...document.cards,
        '1': { ...card, fsrs: { ...card.fsrs, state: State.Review, due: new Date(2026, 8, 25, 12).getTime() } },
      },
      reviewActivity: { date: '2026-09-17', newCards: 1, streak: 1 },
    });
  });

  await waitFor(() => expect(day('September 17, 2026')).toHaveAccessibleName(/0 due$/));
  expect(screen.getByText('No problems due on this day.')).toBeVisible();
  expect(screen.queryByRole('link')).not.toBeInTheDocument();
  fireEvent.click(day('September 18, 2026'));
  expect(await screen.findByRole('link', { name: /2\. Add Two Numbers/ })).toBeVisible();
  expect(screen.getAllByRole('link', { name: /^\d+\./ })).toHaveLength(1);
  expect(day('September 18, 2026')).toHaveAccessibleName(/1 due$/);
});
