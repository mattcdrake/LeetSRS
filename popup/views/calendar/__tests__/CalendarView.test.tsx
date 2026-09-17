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
  expect(day('September 16, 2026')).toHaveAttribute('aria-disabled', 'true');
  fireEvent.click(day('September 16, 2026'));
  expect(day('September 17, 2026')).toHaveAttribute('data-selected');

  fireEvent.click(day('September 18, 2026'));
  expect(day('September 18, 2026')).toHaveAttribute('data-selected');
  expect(within(day('September 18, 2026')).getByText('1 due')).toBeVisible();
  fireEvent.click(day('September 19, 2026'));
  expect(day('September 19, 2026')).toHaveAttribute('data-selected');
  expect(day('September 19, 2026')).not.toHaveAttribute('data-has-due');
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

  await act(async () => {
    await replaceLearningDocument({
      ...document,
      reviewActivity: { date: '2026-09-17', newCards: 1, streak: 0 },
    });
  });
  await waitFor(() => expect(day('September 17, 2026')).toHaveAccessibleName(/0 due$/));
  expect(day('September 18, 2026')).toHaveAccessibleName(/1 due$/);
  expect(day('September 19, 2026')).toHaveAccessibleName(/1 due$/);
});
