// @vitest-environment happy-dom

import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { Rating, State } from 'ts-fsrs';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { watchDocumentTranslations } from '@/data/translations';
import { translations } from '@/i18n';
import { sendMessage } from '@/integrations/browser/messages';
import { buildProblem, createMockCard } from '@/test/utils/card-mocks';
import { createMessageMock } from '@/test/utils/message-mocks';

vi.mock('@/data/translations', () => ({
  watchDocumentTranslations: vi.fn(),
}));
vi.mock('@/integrations/browser/messages', () => ({ sendMessage: vi.fn() }));
const messages = createMessageMock(vi.mocked(sendMessage));
const problem = buildProblem();
const card = createMockCard(State.New);

const unwatch = vi.fn();
beforeEach(() => {
  messages.reset().resolve('rateCard', { card, shouldRequeue: false }).resolve('addCard', card);
  vi.stubGlobal(
    'fetch',
    vi.fn().mockImplementation(async () =>
      Response.json({
        data: {
          question: {
            questionFrontendId: problem.leetcodeId,
            title: problem.name,
            titleSlug: problem.slug,
            difficulty: problem.difficulty,
          },
        },
      })
    )
  );
  Object.defineProperty(window, 'location', {
    value: { pathname: `/problems/${problem.slug}/`, hostname: 'leetcode.com' },
    configurable: true,
  });
  vi.mocked(watchDocumentTranslations).mockImplementation((onChange) => {
    onChange(translations.en);
    return unwatch;
  });
});

afterEach(() => vi.unstubAllGlobals());

import { LeetSrsControl } from '../LeetSrsControl';

function setup() {
  const view = render(<LeetSrsControl />);
  return { ...view, button: screen.getByRole('button', { name: 'LeetSRS' }) };
}

it.each([Rating.Again, Rating.Hard, Rating.Good, Rating.Easy, undefined] as const)(
  'keeps choices disabled until the local save completes for rating %s',
  async (rating) => {
    const pending = Promise.withResolvers<typeof card>();
    messages
      .resolve(
        'rateCard',
        pending.promise.then((card) => ({ card, shouldRequeue: false }))
      )
      .resolve('addCard', pending.promise);
    const { button } = setup();
    fireEvent.click(button);
    const choice = await screen.findByRole('button', {
      name: rating === undefined ? translations.en.contentScript.addToSrsNoRating : translations.en.ratings[rating],
    });
    fireEvent.click(choice);
    await waitFor(() =>
      expect(sendMessage).toHaveBeenCalledWith(
        ...(rating === undefined ? ['addCard', { problem }] : ['rateCard', { input: { ...problem, rating } }])
      )
    );
    expect(button).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getByRole('status')).toHaveTextContent(translations.en.actions.saving);
    expect(choice).toBeDisabled();
    expect(screen.getByRole('button', { name: translations.en.contentScript.addToSrsNoRating })).toBeDisabled();
    fireEvent.click(choice);
    expect(sendMessage).toHaveBeenCalledOnce();
    await act(async () => pending.resolve(card));
    await waitFor(() => expect(button).toHaveAttribute('aria-expanded', 'false'));
    await waitFor(() => expect(button).toHaveFocus());
  }
);

it('shows a failed add and lets the learner retry without a rating', async () => {
  messages.handle('addCard', () => {
    throw new Error('Storage unavailable');
  });
  const { button } = setup();
  fireEvent.click(button);
  fireEvent.click(await screen.findByRole('button', { name: translations.en.contentScript.addToSrsNoRating }));
  expect(await screen.findByRole('alert')).toHaveTextContent('Could not save this problem. Please try again.');
  expect(button).toHaveAttribute('aria-expanded', 'true');
  const add = screen.getByRole('button', { name: translations.en.contentScript.addToSrsNoRating });
  expect(add).not.toBeDisabled();
  messages.resolve('addCard', card);
  fireEvent.click(add);
  await waitFor(() => expect(button).toHaveAttribute('aria-expanded', 'false'));
  expect(sendMessage).toHaveBeenLastCalledWith('addCard', { problem });
  fireEvent.click(button);
  await screen.findByRole('dialog');
  expect(screen.queryByRole('alert')).not.toBeInTheDocument();
});

it('reports unavailable Problem data without saving, then retries the lookup', async () => {
  vi.mocked(fetch).mockResolvedValueOnce(Response.json({ errors: [{ message: 'Unavailable' }] }));
  const { button } = setup();
  fireEvent.click(button);
  fireEvent.click(await screen.findByRole('button', { name: translations.en.ratings[Rating.Good] }));
  expect(await screen.findByRole('alert')).toHaveTextContent(translations.en.contentScript.saveFailed);
  expect(sendMessage).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole('button', { name: translations.en.ratings[Rating.Good] }));
  await waitFor(() => expect(button).toHaveAttribute('aria-expanded', 'false'));
  expect(sendMessage).toHaveBeenCalledExactlyOnceWith('rateCard', { input: { ...problem, rating: Rating.Good } });
});

it('retains a pending lookup when the menu is dismissed and reopened', async () => {
  const lookup = Promise.withResolvers<Response>();
  vi.mocked(fetch).mockReturnValueOnce(lookup.promise);
  const { button } = setup();
  fireEvent.click(button);
  fireEvent.click(await screen.findByRole('button', { name: translations.en.ratings[Rating.Good] }));
  expect(screen.getByRole('status')).toHaveTextContent(translations.en.actions.saving);
  fireEvent.keyDown(document.activeElement ?? document.body, { key: 'Escape' });
  await waitFor(() => expect(button).toHaveAttribute('aria-expanded', 'false'));
  fireEvent.click(button);
  expect(await screen.findByRole('button', { name: translations.en.ratings[Rating.Good] })).toBeDisabled();
  expect(fetch).toHaveBeenCalledOnce();
  expect(sendMessage).not.toHaveBeenCalled();
  await act(async () => lookup.resolve(Response.json({ data: { question: null } })));
  expect(await screen.findByRole('alert')).toHaveTextContent(translations.en.contentScript.saveFailed);
  expect(screen.getByRole('button', { name: translations.en.ratings[Rating.Good] })).not.toBeDisabled();
});

it('dismisses outside clicks and reopens', async () => {
  const { button } = setup();
  fireEvent.click(button);
  await screen.findByRole('button', { name: translations.en.ratings[Rating.Good] });
  fireEvent.pointerDown(document.body, { pointerType: 'mouse', button: 0 });
  fireEvent.pointerUp(document.body, { pointerType: 'mouse', button: 0 });
  fireEvent.click(document.body);
  expect(button).toHaveAttribute('aria-expanded', 'false');
  fireEvent.click(button);
  await screen.findByRole('button', { name: translations.en.ratings[Rating.Good] });
});

it.each(['Enter', ' '])('opens with %s, dismisses with Escape, and returns focus to the trigger', async (key) => {
  const { button } = setup();
  act(() => button.focus());
  fireEvent.keyDown(button, { key, code: key === ' ' ? 'Space' : 'Enter' });
  fireEvent.keyUp(button, { key, code: key === ' ' ? 'Space' : 'Enter' });

  const dialog = await screen.findByRole('dialog', { name: 'LeetSRS' });
  await waitFor(() => expect(dialog.contains(document.activeElement)).toBe(true));
  fireEvent.keyDown(document.activeElement ?? dialog, { key: 'Escape' });

  await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
  await waitFor(() => expect(button).toHaveFocus());
  expect(sendMessage).not.toHaveBeenCalled();
});

it('keeps inside interactions open and removes the popover on unmount', async () => {
  const { button, unmount } = setup();
  fireEvent.click(button);
  const dialog = await screen.findByRole('dialog');
  fireEvent.pointerDown(dialog, { pointerType: 'mouse', button: 0 });
  fireEvent.click(dialog);
  expect(button).toHaveAttribute('aria-expanded', 'true');

  unmount();
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  expect(sendMessage).not.toHaveBeenCalled();
});

it('cycles focus through every choice with Tab after opening with the mouse', async () => {
  const { button } = setup();
  fireEvent.pointerDown(button, { pointerType: 'mouse', button: 0 });
  fireEvent.pointerUp(button, { pointerType: 'mouse', button: 0 });
  fireEvent.click(button);

  const dialog = await screen.findByRole('dialog');
  await waitFor(() => expect(dialog.contains(document.activeElement)).toBe(true));
  const choices = Array.from(dialog.querySelectorAll('button'));
  // Pointer opening may focus the dialog itself or its first choice.
  if (document.activeElement === dialog) fireEvent.keyDown(dialog, { key: 'Tab' });
  expect(choices[0]).toHaveFocus();

  for (const choice of [...choices.slice(1), choices[0]]) {
    fireEvent.keyDown(document.activeElement ?? dialog, { key: 'Tab' });
    expect(choice).toHaveFocus();
    expect(choice).toHaveAttribute('data-focused', 'true');
  }
  expect(sendMessage).not.toHaveBeenCalled();
});

it('updates an open menu when stored language changes without resubscribing on clicks', async () => {
  const { button, unmount } = setup();
  fireEvent.click(button);
  const onChange = vi.mocked(watchDocumentTranslations).mock.calls[0][0];
  act(() => onChange(translations.pl));
  fireEvent.click(screen.getByRole('button', { name: translations.pl.ratings[Rating.Good] }));
  await waitFor(() => expect(button).toHaveAttribute('aria-expanded', 'false'));
  fireEvent.click(button);
  expect(watchDocumentTranslations).toHaveBeenCalledOnce();
  unmount();
  expect(unwatch).toHaveBeenCalledOnce();
});
