/** @vitest-environment happy-dom */
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { Button, Heading } from 'react-aria-components';
import { expect, it, vi } from 'vitest';
import { createTestWrapper } from '@/test/utils/test-wrapper';
import { PopupDialogHost } from '../PopupDialogHost';
import { dialogEligibilityQueryKey, type PopupDialogEntry } from '../registry';

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
  const { wrapper, queryClient } = createTestWrapper();
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
  const { wrapper, queryClient } = createTestWrapper();
  const loadFirst = vi.fn<() => Promise<boolean>>().mockRejectedValue(new Error('Unavailable'));
  const registry = [dialog('first', loadFirst), dialog('later', async () => true)];
  render(<PopupDialogHost registry={registry} />, { wrapper });

  await waitFor(() => expect(queryClient.getQueryState(dialogEligibilityQueryKey('first'))?.status).toBe('error'));
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument();

  loadFirst.mockResolvedValue(false);
  await act(() => queryClient.invalidateQueries({ queryKey: dialogEligibilityQueryKey('first') }));
  expect(await screen.findByRole('dialog', { name: 'later' })).toBeInTheDocument();
});

it('shows no dialog for an empty registry or when no entry is eligible', async () => {
  const { wrapper, queryClient } = createTestWrapper();
  const view = render(<PopupDialogHost registry={[]} />, { wrapper });
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument();

  view.rerender(<PopupDialogHost registry={[dialog('ineligible', async () => false)]} />);
  await waitFor(() => expect(queryClient.getQueryData(dialogEligibilityQueryKey('ineligible'))).toBe(false));
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
});
