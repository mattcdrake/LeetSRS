/** @vitest-environment happy-dom */
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { State } from 'ts-fsrs';
import { beforeEach, expect, it, vi } from 'vitest';
import { fakeBrowser } from 'wxt/testing/fake-browser';
import { acknowledgePopupDialog, resolveRatingCta } from '@/background/popup-dialogs';
import { background } from '@/shared/background-service';
import { addLocalDays, formatLocalDate } from '@/shared/calendar';
import { type LearningDocument, learningDocumentItem } from '@/shared/learning-document';
import { readPopupDialogAcknowledgments } from '@/shared/popup-dialogs';
import { readRatingCtaResolution, writeRatingCtaResolution } from '@/shared/rating-cta';
import { createMockCard } from '@/test/utils/card-mocks';
import { buildLearningDocument } from '@/test/utils/learning-document-mocks';
import { createServiceMock } from '@/test/utils/service-mocks';
import { createPopupTestWrapper } from '@/test/utils/test-wrapper';
import { PopupDialogHost } from '../PopupDialogHost';
import { loadStreakRatingEligibility, STREAK_RATING_DIALOG_ID, StreakRatingPrompt } from '../StreakRatingPrompt';

vi.mock('@/shared/background-service');
const service = createServiceMock(background);

beforeEach(() => {
  fakeBrowser.reset();
  service.reset().handle('acknowledgePopupDialog', acknowledgePopupDialog).handle('resolveRatingCta', resolveRatingCta);
});

const today = () => formatLocalDate(new Date());
const yesterday = () => formatLocalDate(addLocalDays(new Date(), -1));

function storeDocument(overrides: Partial<LearningDocument> = {}) {
  return learningDocumentItem.setValue(
    buildLearningDocument({ reviewActivity: { date: today(), newCards: 0, streak: 7 }, ...overrides })
  );
}

it.each([
  { name: 'a 7-day streak with a cleared queue', eligible: true },
  { name: 'a shorter streak', activity: { streak: 6 }, eligible: false },
  { name: 'a streak without a review today', activity: { date: 'yesterday' }, eligible: false },
  { name: 'reviews still due', cards: { '1': createMockCard(State.Review) }, eligible: false },
])('is eligible only after $name', async ({ activity, cards, eligible }) => {
  await storeDocument({
    reviewActivity: {
      newCards: 0,
      streak: activity?.streak ?? 7,
      date: activity?.date === 'yesterday' ? yesterday() : today(),
    },
    cards: cards ?? {},
  });
  expect(await loadStreakRatingEligibility()).toBe(eligible);
});

it('stays hidden after any rating prompt was rated or declined', async () => {
  await storeDocument();
  await writeRatingCtaResolution({ outcome: 'declined', dialogId: 'earlier-prompt' });
  expect(await loadStreakRatingEligibility()).toBe(false);
});

const registry = [
  { id: STREAK_RATING_DIALOG_ID, loadEligibility: loadStreakRatingEligibility, Content: StreakRatingPrompt },
];

it.each([
  { action: 'Rate on Chrome Web Store', outcome: 'rated' },
  { action: 'No thanks', outcome: 'declined' },
] as const)('records $outcome for later rating prompts', async ({ action, outcome }) => {
  await storeDocument();
  render(<PopupDialogHost registry={registry} onNavigate={vi.fn()} />, { wrapper: createPopupTestWrapper().wrapper });

  const control = await screen.findByRole(action === 'No thanks' ? 'button' : 'link', { name: action });
  // Keep happy-dom from following the store link.
  control.addEventListener('click', (event) => event.preventDefault());
  fireEvent.click(control);

  await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
  await waitFor(async () =>
    expect(await readRatingCtaResolution()).toEqual({ outcome, dialogId: STREAK_RATING_DIALOG_ID })
  );
  expect(await loadStreakRatingEligibility()).toBe(false);
});

it('closing hides only this prompt and leaves later rating prompts eligible', async () => {
  await storeDocument();
  render(<PopupDialogHost registry={registry} onNavigate={vi.fn()} />, { wrapper: createPopupTestWrapper().wrapper });

  fireEvent.click(await screen.findByRole('button', { name: 'Close' }));

  await waitFor(async () =>
    expect(await readPopupDialogAcknowledgments()).toEqual({ [STREAK_RATING_DIALOG_ID]: true })
  );
  expect(await readRatingCtaResolution()).toBeNull();
  expect(background.resolveRatingCta).not.toHaveBeenCalled();
});
