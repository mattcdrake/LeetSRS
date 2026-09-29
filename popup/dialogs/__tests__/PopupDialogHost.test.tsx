/** @vitest-environment happy-dom */
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { StrictMode } from 'react';
import { Button, Heading } from 'react-aria-components';
import { beforeEach, expect, it, vi } from 'vitest';
import { fakeBrowser } from 'wxt/testing/fake-browser';
import { acknowledgePopupDialog } from '@/background/popup-dialogs';
import { background } from '@/shared/background-service';
import { readPopupDialogAcknowledgments } from '@/shared/popup-dialogs';
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
  render(<PopupDialogHost registry={registry} onNavigate={vi.fn()} />, { wrapper });

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

it('acknowledges only the displayed dialog when the popup closes and resumes with the next entry', async () => {
  const registry = [dialog('first', async () => true), dialog('later', async () => true)];
  const view = render(
    <StrictMode>
      <PopupDialogHost registry={registry} onNavigate={vi.fn()} />
    </StrictMode>,
    { wrapper: createPopupTestWrapper().wrapper }
  );
  expect(await screen.findByRole('dialog', { name: 'first' })).toBeInTheDocument();
  fireEvent(window, new Event('pagehide'));
  view.unmount();
  await waitFor(async () => expect(await readPopupDialogAcknowledgments()).toEqual({ first: true }));
  expect(background.acknowledgePopupDialog).toHaveBeenCalledExactlyOnceWith('first');

  render(<PopupDialogHost registry={registry} onNavigate={vi.fn()} />, {
    wrapper: createPopupTestWrapper().wrapper,
  });
  expect(await screen.findByRole('dialog', { name: 'later' })).toBeInTheDocument();
});
