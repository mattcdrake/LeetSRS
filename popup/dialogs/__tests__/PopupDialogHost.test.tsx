/** @vitest-environment happy-dom */
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { StrictMode } from 'react';
import { Button, Heading } from 'react-aria-components';
import { beforeEach, expect, it, vi } from 'vitest';
import { fakeBrowser } from 'wxt/testing/fake-browser';
import { storage } from '#imports';
import { acknowledgePopupDialog } from '@/background/popup-dialogs';
import { popupDialogAcknowledgmentsQueryKey } from '@/popup/queries/popup-dialogs';
import { background } from '@/shared/background-service';
import { readPopupDialogAcknowledgments, STORAGE_KEYS } from '@/shared/storage';
import { createServiceMock } from '@/test/utils/service-mocks';
import { createPopupTestWrapper } from '@/test/utils/test-wrapper';
import { PopupDialogHost } from '../PopupDialogHost';
import { dialogEligibilityQueryKey, type PopupDialogEntry } from '../registry';

vi.mock('@/shared/background-service');
const service = createServiceMock(background);

beforeEach(() => {
  fakeBrowser.reset();
  service.reset().handle('acknowledgePopupDialog', acknowledgePopupDialog);
});

function dialog(id: string, loadEligibility: () => Promise<boolean>): PopupDialogEntry {
  return {
    id,
    loadEligibility,
    Content: ({ onDismiss }) => (
      <>
        <Heading slot="title">{id}</Heading>
        <Button onPress={onDismiss}>Continue</Button>
      </>
    ),
  };
}

it('waits for eligibility and shows one dialog at a time in registry order', async () => {
  const { wrapper, queryClient } = createPopupTestWrapper();
  const first = Promise.withResolvers<boolean>();
  const registry = [
    dialog('z-first', () => first.promise),
    dialog('ineligible', async () => false),
    dialog('a-later', async () => true),
  ];
  render(<PopupDialogHost registry={registry} />, { wrapper });

  await waitFor(() => expect(queryClient.getQueryData(dialogEligibilityQueryKey('a-later'))).toBe(true));
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument();

  await act(async () => first.resolve(true));
  expect(await screen.findByRole('dialog', { name: 'z-first' })).toBeInTheDocument();
  expect(screen.getAllByRole('dialog')).toHaveLength(1);

  fireEvent.click(screen.getByRole('button', { name: 'Continue' }));
  expect(await screen.findByRole('dialog', { name: 'a-later' })).toBeInTheDocument();
  expect(screen.getAllByRole('dialog')).toHaveLength(1);

  fireEvent.keyDown(screen.getByRole('dialog'), { key: 'Escape', code: 'Escape' });
  await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
});

it('does not select a later dialog when eligibility fails, and resumes after recovery', async () => {
  const { wrapper, queryClient } = createPopupTestWrapper();
  const loadFirst = vi.fn<() => Promise<boolean>>().mockRejectedValue(new Error('Unavailable'));
  const registry = [dialog('first', loadFirst), dialog('later', async () => true)];
  render(<PopupDialogHost registry={registry} />, { wrapper });

  await waitFor(() => expect(queryClient.getQueryState(dialogEligibilityQueryKey('first'))?.status).toBe('error'));
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument();

  loadFirst.mockResolvedValue(false);
  await act(() => queryClient.invalidateQueries({ queryKey: dialogEligibilityQueryKey('first') }));
  expect(await screen.findByRole('dialog', { name: 'later' })).toBeInTheDocument();
});

it('waits for acknowledgment reads and recovers without showing an already acknowledged dialog', async () => {
  const { wrapper, queryClient } = createPopupTestWrapper();
  const registry = [dialog('first', async () => true), dialog('later', async () => true)];
  await storage.setItem(STORAGE_KEYS.popupDialogAcknowledgments, { first: true });
  const pending = Promise.withResolvers<void>();
  const getItem = storage.getItem.bind(storage);
  const read = vi.spyOn(storage, 'getItem').mockImplementation(async (key, options) => {
    if (key === STORAGE_KEYS.popupDialogAcknowledgments) await pending.promise;
    return getItem(key, options);
  });
  render(<PopupDialogHost registry={registry} />, { wrapper });

  await waitFor(() => expect(queryClient.getQueryData(dialogEligibilityQueryKey('first'))).toBe(true));
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  await act(async () => pending.reject(new Error('Storage unavailable')));
  await waitFor(() => expect(queryClient.getQueryState(popupDialogAcknowledgmentsQueryKey)?.status).toBe('error'));
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument();

  read.mockRestore();
  await act(() => queryClient.invalidateQueries({ queryKey: popupDialogAcknowledgmentsQueryKey }));
  expect(await screen.findByRole('dialog', { name: 'later' })).toBeInTheDocument();
});

it.each(['success', 'failure'] as const)(
  'closes immediately, waits for the save attempt, and advances after %s',
  async (outcome) => {
    const save = Promise.withResolvers<void>();
    service.handle('acknowledgePopupDialog', async (id) => {
      await save.promise;
      await acknowledgePopupDialog(id);
    });
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    const registry = [dialog('first', async () => true), dialog('later', async () => true)];
    const view = render(<PopupDialogHost registry={registry} />, { wrapper: createPopupTestWrapper().wrapper });
    expect(await screen.findByRole('dialog', { name: 'first' })).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Continue' }));
    await waitFor(() => expect(background.acknowledgePopupDialog).toHaveBeenCalledWith('first'));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(await readPopupDialogAcknowledgments()).toEqual({});

    await act(async () => {
      if (outcome === 'success') save.resolve();
      else save.reject(new Error('Save failed'));
    });
    expect(await screen.findByRole('dialog', { name: 'later' })).toBeInTheDocument();
    expect(background.acknowledgePopupDialog).toHaveBeenCalledTimes(1);
    expect(await readPopupDialogAcknowledgments()).toEqual(outcome === 'success' ? { first: true } : {});

    view.unmount();
    render(<PopupDialogHost registry={registry} />, { wrapper: createPopupTestWrapper().wrapper });
    expect(await screen.findByRole('dialog', { name: outcome === 'success' ? 'later' : 'first' })).toBeInTheDocument();
  }
);

it('acknowledges only the displayed dialog when the popup closes and resumes with the next entry', async () => {
  const registry = [dialog('first', async () => true), dialog('later', async () => true)];
  const view = render(
    <StrictMode>
      <PopupDialogHost registry={registry} />
    </StrictMode>,
    { wrapper: createPopupTestWrapper().wrapper }
  );
  expect(await screen.findByRole('dialog', { name: 'first' })).toBeInTheDocument();
  fireEvent(window, new Event('pagehide'));
  view.unmount();
  await waitFor(async () => expect(await readPopupDialogAcknowledgments()).toEqual({ first: true }));
  expect(background.acknowledgePopupDialog).toHaveBeenCalledExactlyOnceWith('first');

  render(<PopupDialogHost registry={registry} />, { wrapper: createPopupTestWrapper().wrapper });
  expect(await screen.findByRole('dialog', { name: 'later' })).toBeInTheDocument();
});
