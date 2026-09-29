/** @vitest-environment happy-dom */
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
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
  await screen.findByRole('grid', { name: /^Calendar, September 13\s–\sOctober 10, 2026$/ });
}

function day(name: string) {
  return screen.getByRole('button', { name: new RegExp(name) });
}

it('updates counts and problems when a review consumes today’s new-card allowance', async () => {
  const card = createMockCard(State.New);
  const document = buildLearningDocument({
    cards: { '1': card, '2': { ...card, frontendId: '2' } },
    settings: { maxNewCardsPerDay: 1 },
  });
  await openCalendar(document);
  expect(day('September 17, 2026')).toHaveAccessibleName(/1 due, 1 overdue$/);
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
  expect(screen.getByRole('listitem')).toHaveTextContent('New');
  expect(screen.getByRole('region')).toHaveTextContent('1 due · 1 new');
});
