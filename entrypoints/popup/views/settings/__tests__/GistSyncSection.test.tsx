/**
 * @vitest-environment happy-dom
 */
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { GistConnectionResult, GistSyncConfig } from '@/domain/gist-sync';
import { gistSyncQueryKeys } from '@/entrypoints/popup/queries/gist-sync';
import { sendMessage } from '@/infrastructure/browser/messages';
import { createMessageMock } from '@/test/utils/message-mocks';
import { createTestWrapper } from '@/test/utils/test-wrapper';
import { GistSyncSection } from '../GistSyncSection';

vi.mock('@/infrastructure/browser/messages', () => ({ sendMessage: vi.fn() }));

const messages = createMessageMock(vi.mocked(sendMessage));
let config: GistSyncConfig;
let test: ReturnType<typeof createTestWrapper>;

beforeEach(() => {
  config = { pat: 'saved-pat', gistId: 'saved-gist', enabled: false };
  messages
    .reset()
    .handle('getGistSyncConfig', () => config)
    .resolve('getGistSyncStatus', {
      lastSyncTime: null,
      lastSyncDirection: null,
      syncInProgress: false,
      lastError: null,
    })
    .resolve('setupGistSync', { saved: true })
    .resolve('setGistSyncEnabled', { saved: true })
    .resolve('triggerGistSync', { success: true, action: 'no-change', timestamp: '2026-09-12' });
  test = createTestWrapper();
});

afterEach(() => vi.useRealTimers());

async function open() {
  const view = render(<GistSyncSection />, { wrapper: test.wrapper });
  await waitFor(() => expect(screen.getByLabelText('Personal Access Token')).toHaveValue('saved-pat'));
  return view;
}

function enterCredentials() {
  fireEvent.change(screen.getByLabelText('Personal Access Token'), { target: { value: 'entered-pat' } });
  fireEvent.change(screen.getByLabelText('Gist ID'), { target: { value: 'entered-gist' } });
}

describe('Gist setup form', () => {
  it('submits entered credentials in one Save operation', async () => {
    messages.handle('setupGistSync', (input) => {
      config = { pat: input.pat, gistId: input.mode === 'existing' ? input.gistId : 'created', enabled: false };
      return { saved: true };
    });
    await open();
    enterCredentials();
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));
    await waitFor(() => expect(screen.getByRole('status')).toHaveTextContent('Connection saved'));
    expect(sendMessage).toHaveBeenCalledWith('setupGistSync', {
      mode: 'existing',
      pat: 'entered-pat',
      gistId: 'entered-gist',
    });
    expect(screen.getByRole('link', { name: /entered-gist/ })).toHaveAttribute(
      'href',
      'https://gist.github.com/entered-gist'
    );
  });
  it('recovers a created Gist ID after save failure and retries without creating again', async () => {
    let attempts = 0;
    messages.handle('setupGistSync', (input) => {
      attempts++;
      if (attempts === 1) return { saved: false, error: 'Storage unavailable', createdGistId: 'created-gist' };
      config = { pat: input.pat, gistId: 'created-gist', enabled: false };
      return { saved: true };
    });
    await open();
    enterCredentials();
    fireEvent.click(screen.getByRole('radio', { name: 'Create New Gist' }));
    expect(screen.queryByLabelText('Gist ID')).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));
    await waitFor(() =>
      expect(screen.getByRole('alert')).toHaveTextContent('Connection could not be saved: Storage unavailable')
    );
    expect(screen.getByLabelText('Personal Access Token')).toHaveValue('entered-pat');
    expect(screen.getByLabelText('Gist ID')).toHaveValue('created-gist');
    expect(screen.getByRole('radio', { name: 'Use existing Gist' })).toBeChecked();
    expect(screen.getByRole('link', { name: /saved-gist/ })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));
    await waitFor(() => expect(screen.getByRole('status')).toHaveTextContent('Connection saved'));
    expect(vi.mocked(sendMessage).mock.calls.filter(([name]) => name === 'setupGistSync')).toEqual([
      ['setupGistSync', { mode: 'create', pat: 'entered-pat' }],
      ['setupGistSync', { mode: 'existing', pat: 'entered-pat', gistId: 'created-gist' }],
    ]);
  });

  it.each(['setup failure', 'transport failure'])(
    'preserves drafts when polling discovers browser-sync updates and after %s',
    async (failure) => {
      vi.useFakeTimers({ toFake: ['setInterval', 'clearInterval'] });
      messages.handle('setupGistSync', () => {
        if (failure === 'transport failure') throw new Error('Disconnected');
        return { saved: false, error: 'Network unavailable' };
      });
      await open();
      enterCredentials();
      config = { pat: 'other-browser-pat', gistId: 'other-browser-gist', enabled: true };
      await act(async () => {
        await vi.advanceTimersByTimeAsync(15000);
      });
      await waitFor(() => expect(screen.getByRole('link', { name: /other-browser-gist/ })).toBeInTheDocument());
      expect(screen.getByLabelText('Personal Access Token')).toHaveValue('entered-pat');
      expect(screen.getByLabelText('Gist ID')).toHaveValue('entered-gist');
      expect(screen.getByRole('switch')).toBeChecked();
      fireEvent.click(screen.getByRole('button', { name: 'Save' }));
      await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent('Connection could not be saved'));
      await act(async () => {
        await test.queryClient.invalidateQueries({ queryKey: gistSyncQueryKeys.config });
      });
      expect(screen.getByLabelText('Personal Access Token')).toHaveValue('entered-pat');
      expect(screen.getByLabelText('Gist ID')).toHaveValue('entered-gist');
    }
  );

  it.each(['setup', 'enable', 'manual'] as const)(
    'locks conflicting controls while %s is pending and permits retry',
    async (operation) => {
      const pending = Promise.withResolvers<GistConnectionResult>();
      if (operation === 'setup') messages.resolve('setupGistSync', pending.promise);
      else if (operation === 'enable') messages.resolve('setGistSyncEnabled', pending.promise);
      else
        messages.handle('triggerGistSync', async () => {
          await pending.promise;
          return { success: false, error: 'Network unavailable' };
        });
      await open();
      enterCredentials();
      fireEvent.click(
        operation === 'enable'
          ? screen.getByRole('switch')
          : screen.getByRole('button', { name: operation === 'setup' ? 'Save' : 'Sync Now' })
      );
      await waitFor(() => expect(screen.getByRole('switch')).toBeDisabled());
      expect(screen.getByLabelText('Personal Access Token')).toBeDisabled();
      expect(screen.getByLabelText('Gist ID')).toBeDisabled();
      expect(screen.getByRole('radio', { name: 'Create New Gist' })).toBeDisabled();
      expect(screen.getByRole('button', { name: /^(Save|Saving…)$/ })).toBeDisabled();
      expect(screen.getByRole('button', { name: /^(Sync Now|Syncing...)$/ })).toBeDisabled();
      if (operation === 'enable') expect(sendMessage).toHaveBeenCalledWith('setGistSyncEnabled', { enabled: true });
      await act(async () => {
        pending.resolve({ saved: false, error: 'Network unavailable' });
      });
      await waitFor(() => expect(screen.getByRole('switch')).toBeEnabled());
      expect(screen.getByLabelText('Personal Access Token')).toHaveValue('entered-pat');
      expect(screen.getByRole('alert')).toHaveTextContent('Network unavailable');
      expect(screen.getByRole('button', { name: 'Save' })).toBeEnabled();
    }
  );

  it.each(['setup', 'enable', 'manual', 'lost response'] as const)(
    'refreshes configuration, status, and learning views after %s fails following a pull',
    async (operation) => {
      test.queryClient.setQueryData(['cards'], ['old card']);
      test.queryClient.setQueryData(['settings'], { theme: 'dark' });
      let pulled = false;
      const learning = vi.fn(async () => (pulled ? ['pulled card'] : ['old card']));
      const { QueryObserver } = await import('@tanstack/react-query');
      const observer = new QueryObserver(test.queryClient, { queryKey: ['cards'], queryFn: learning });
      const unsubscribe = observer.subscribe(() => {});
      const afterPull = () => {
        pulled = true;
        config = { pat: 'entered-pat', gistId: 'entered-gist', enabled: true };
        return { saved: true, sync: { success: false, error: 'Status unavailable' } } as const;
      };
      messages
        .handle('setupGistSync', afterPull)
        .handle('setGistSyncEnabled', afterPull)
        .handle('triggerGistSync', () => {
          afterPull();
          if (operation === 'lost response') throw new Error('Disconnected after pull');
          return { success: false, error: 'Status unavailable' };
        });
      await open();
      enterCredentials();
      vi.mocked(sendMessage).mockClear();
      fireEvent.click(
        operation === 'enable'
          ? screen.getByRole('switch')
          : screen.getByRole('button', { name: operation === 'setup' ? 'Save' : 'Sync Now' })
      );
      await waitFor(() =>
        expect(screen.getByRole('alert')).toHaveTextContent(
          operation === 'setup' || operation === 'enable' ? 'Connection saved, but sync failed' : 'Sync failed'
        )
      );
      expect(sendMessage).toHaveBeenCalledWith('getGistSyncConfig');
      expect(sendMessage).toHaveBeenCalledWith('getGistSyncStatus');
      expect(test.queryClient.getQueryData(['cards'])).toEqual(['pulled card']);
      expect(test.queryClient.getQueryState(['settings'])?.isInvalidated).toBe(true);
      expect(screen.getByRole('switch')).toBeChecked();
      unsubscribe();
    }
  );

  it('requires both entered fields in existing mode and keeps saved manual sync usable with an incomplete draft', async () => {
    await open();
    fireEvent.change(screen.getByLabelText('Personal Access Token'), { target: { value: '' } });
    expect(screen.getByRole('button', { name: 'Save' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Sync Now' })).toBeEnabled();
    fireEvent.click(screen.getByRole('button', { name: 'Sync Now' }));
    await waitFor(() => expect(screen.getByRole('status')).toHaveTextContent('Sync complete'));
    expect(sendMessage).toHaveBeenCalledWith('triggerGistSync');
    expect(screen.getByRole('switch')).not.toBeChecked();
    fireEvent.change(screen.getByLabelText('Personal Access Token'), { target: { value: 'entered-pat' } });
    fireEvent.change(screen.getByLabelText('Gist ID'), { target: { value: '  ' } });
    expect(screen.getByRole('button', { name: 'Save' })).toBeDisabled();
    fireEvent.click(screen.getByRole('radio', { name: 'Create New Gist' }));
    expect(screen.getByRole('button', { name: 'Save' })).toBeEnabled();
  });

  it('allows the background setup request to finish after the popup unmounts', async () => {
    const pending = Promise.withResolvers<GistConnectionResult>();
    const complete = vi.fn();
    messages.handle('setupGistSync', async () => {
      const result = await pending.promise;
      complete();
      return result;
    });
    const view = await open();
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));
    await waitFor(() => expect(sendMessage).toHaveBeenCalledWith('setupGistSync', expect.any(Object)));
    view.unmount();
    await act(async () => {
      pending.resolve({ saved: true });
    });
    expect(complete).toHaveBeenCalledOnce();
  });
});
