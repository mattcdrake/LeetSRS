/**
 * @vitest-environment happy-dom
 */
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { storage } from '#imports';
import type { GistConnectionResult, GistSyncConfig } from '@/domain/gist-sync';
import { gistSyncQueryKeys } from '@/entrypoints/popup/queries/gist-sync';
import { sendMessage } from '@/infrastructure/browser/messages';
import { replaceLearningDocument } from '@/infrastructure/storage/learning-document';
import { STORAGE_KEYS } from '@/infrastructure/storage/storage-keys';
import { buildLearningDocument } from '@/test/utils/learning-document-mocks';
import { createMessageMock } from '@/test/utils/message-mocks';
import { createTestWrapper } from '@/test/utils/test-wrapper';
import { GistSyncSection } from '../GistSyncSection';

vi.mock('@/infrastructure/browser/messages', () => ({ sendMessage: vi.fn() }));

const messages = createMessageMock(vi.mocked(sendMessage));
let config: GistSyncConfig;
let test: ReturnType<typeof createTestWrapper>;

beforeEach(async () => {
  await replaceLearningDocument(buildLearningDocument());
  config = { pat: 'saved-pat', gistId: 'saved-gist', enabled: false };
  messages
    .reset()
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

async function open(edit = true) {
  await storage.setItem(STORAGE_KEYS.gistConnection, config);
  const view = render(<GistSyncSection />, { wrapper: test.wrapper });
  await screen.findByRole('button', { name: 'Edit' });
  if (edit) fireEvent.click(screen.getByRole('button', { name: 'Edit' }));
  return view;
}

function enterCredentials() {
  fireEvent.change(screen.getByLabelText('Personal Access Token'), { target: { value: 'entered-pat' } });
  fireEvent.change(screen.getByLabelText('Gist ID'), { target: { value: 'entered-gist' } });
}

describe('Gist setup form', () => {
  it('resets initial setup on Cancel and shows the saved connection after Save', async () => {
    config = { pat: '', gistId: null, enabled: false };
    messages.handle('setupGistSync', async (input) => {
      config = { pat: input.pat, gistId: input.mode === 'existing' ? input.gistId : 'created', enabled: false };
      await storage.setItem(STORAGE_KEYS.gistConnection, config);
      return { saved: true };
    });
    await storage.setItem(STORAGE_KEYS.gistConnection, config);
    render(<GistSyncSection />, { wrapper: test.wrapper });
    await waitFor(() => expect(screen.getByLabelText('Personal Access Token')).toBeEnabled());
    expect(screen.queryByRole('button', { name: 'Edit' })).not.toBeInTheDocument();
    enterCredentials();
    fireEvent.click(screen.getByRole('radio', { name: 'Create New Gist' }));
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(screen.getByLabelText('Personal Access Token')).toHaveValue('');
    expect(screen.getByLabelText('Personal Access Token')).toHaveFocus();
    expect(screen.getByLabelText('Gist ID')).toHaveValue('');
    expect(screen.getByRole('radio', { name: 'Use existing Gist' })).toBeChecked();
    expect(screen.getByRole('button', { name: 'Save' })).toBeDisabled();
    expect(sendMessage).not.toHaveBeenCalledWith('setupGistSync', expect.anything());
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
    expect(screen.queryByLabelText('Personal Access Token')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Edit' })).toBeInTheDocument();
  });
  it.each([false, true])(
    'isolates an edit session from refetches and reopens the latest configuration (changed: %s)',
    async (changed) => {
      await open(false);
      expect(screen.queryByLabelText('Personal Access Token')).not.toBeInTheDocument();
      expect(screen.getByText('Never')).toBeInTheDocument();
      fireEvent.click(screen.getByRole('button', { name: 'Edit' }));
      expect(screen.getByLabelText('Personal Access Token')).toHaveFocus();
      if (changed) enterCredentials();
      config = { pat: 'other-browser-pat', gistId: 'other-browser-gist', enabled: true };
      await storage.setItem(STORAGE_KEYS.gistConnection, config);
      await act(async () => {
        await storage.setItem(STORAGE_KEYS.gistConnection, config);
      });
      expect(screen.getByLabelText('Personal Access Token')).toHaveValue(changed ? 'entered-pat' : 'saved-pat');
      expect(screen.getByLabelText('Gist ID')).toHaveValue(changed ? 'entered-gist' : 'saved-gist');
      fireEvent.click(screen.getByRole('radio', { name: 'Create New Gist' }));
      fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
      expect(screen.getByRole('button', { name: 'Edit' })).toHaveFocus();
      expect(screen.getByRole('link', { name: /other-browser-gist/ })).toBeInTheDocument();
      expect(screen.getByRole('switch')).toBeChecked();
      fireEvent.click(screen.getByRole('button', { name: 'Edit' }));
      expect(screen.getByLabelText('Personal Access Token')).toHaveValue('other-browser-pat');
      expect(screen.getByLabelText('Gist ID')).toHaveValue('other-browser-gist');
      expect(screen.getByRole('radio', { name: 'Use existing Gist' })).toBeChecked();
      expect(sendMessage).not.toHaveBeenCalledWith('setupGistSync', expect.anything());
    }
  );

  it('opens setup when browser sync removes the saved connection and preserves that session on later refetches', async () => {
    await open(false);
    config = { pat: '', gistId: null, enabled: false };
    await act(async () => {
      await storage.setItem(STORAGE_KEYS.gistConnection, config);
    });
    await waitFor(() => expect(screen.getByLabelText('Personal Access Token')).toHaveValue(''));
    config = { pat: 'remote-pat', gistId: 'remote-gist', enabled: true };
    await act(async () => {
      await storage.setItem(STORAGE_KEYS.gistConnection, config);
    });
    await waitFor(() => expect(screen.getByLabelText('Personal Access Token')).toHaveValue(''));
    fireEvent.click(await screen.findByRole('button', { name: 'Cancel' }));
    expect(screen.getByRole('link', { name: /remote-gist/ })).toBeInTheDocument();
  });

  it('can cancel drafts after browser sync removes the connection during editing', async () => {
    await open();
    enterCredentials();
    config = { pat: '', gistId: null, enabled: false };
    await act(async () => {
      await storage.setItem(STORAGE_KEYS.gistConnection, config);
    });
    await waitFor(() => expect(test.queryClient.getQueryData(gistSyncQueryKeys.config)).toEqual(config));
    expect(screen.getByLabelText('Personal Access Token')).toHaveValue('entered-pat');
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(screen.getByLabelText('Personal Access Token')).toHaveValue('');
    expect(screen.getByLabelText('Gist ID')).toHaveValue('');
    expect(screen.getByRole('button', { name: 'Save' })).toBeDisabled();
    expect(sendMessage).not.toHaveBeenCalledWith('setupGistSync', expect.anything());
  });

  it('recovers a created Gist ID after save failure and retries without creating again', async () => {
    let attempts = 0;
    messages.handle('setupGistSync', async (input) => {
      attempts++;
      if (attempts === 1) return { saved: false, error: 'Storage unavailable', createdGistId: 'created-gist' };
      config = { pat: input.pat, gistId: 'created-gist', enabled: false };
      await storage.setItem(STORAGE_KEYS.gistConnection, config);
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
    expect(screen.queryByRole('button', { name: 'Edit' })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));
    await waitFor(() => expect(screen.getByRole('status')).toHaveTextContent('Connection saved'));
    expect(vi.mocked(sendMessage).mock.calls.filter(([name]) => name === 'setupGistSync')).toEqual([
      ['setupGistSync', { mode: 'create', pat: 'entered-pat' }],
      ['setupGistSync', { mode: 'existing', pat: 'entered-pat', gistId: 'created-gist' }],
    ]);
  });

  it.each(['setup failure', 'transport failure'])(
    'preserves drafts when storage events deliver browser-sync updates and after %s',
    async (failure) => {
      vi.useFakeTimers({ toFake: ['setInterval', 'clearInterval'] });
      messages.handle('setupGistSync', () => {
        if (failure === 'transport failure') throw new Error('Disconnected');
        return { saved: false, error: 'Network unavailable' };
      });
      await open();
      enterCredentials();
      config = { pat: 'other-browser-pat', gistId: 'other-browser-gist', enabled: true };
      await storage.setItem(STORAGE_KEYS.gistConnection, config);
      await act(async () => {
        await storage.setItem(STORAGE_KEYS.gistConnection, config);
      });
      await waitFor(() => expect(test.queryClient.getQueryData(gistSyncQueryKeys.config)).toEqual(config));
      expect(screen.getByLabelText('Personal Access Token')).toHaveValue('entered-pat');
      expect(screen.getByLabelText('Gist ID')).toHaveValue('entered-gist');
      fireEvent.click(screen.getByRole('button', { name: 'Save' }));
      await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent('Connection could not be saved'));
      await act(async () => {
        await storage.setItem(STORAGE_KEYS.gistConnection, config);
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
      await open(operation === 'setup');
      if (operation === 'setup') enterCredentials();
      fireEvent.click(
        operation === 'enable'
          ? screen.getByRole('switch')
          : screen.getByRole('button', { name: operation === 'setup' ? 'Save' : 'Sync Now' })
      );
      if (operation === 'setup') {
        await waitFor(() => expect(screen.getByRole('button', { name: 'Saving…' })).toBeDisabled());
        expect(screen.getByLabelText('Personal Access Token')).toBeDisabled();
        expect(screen.getByLabelText('Gist ID')).toBeDisabled();
        expect(screen.getByRole('radio', { name: 'Create New Gist' })).toBeDisabled();
        expect(screen.getByRole('button', { name: 'Cancel' })).toBeDisabled();
      } else {
        await waitFor(() => expect(screen.getByRole('switch')).toBeDisabled());
        expect(screen.getByRole('button', { name: 'Edit' })).toBeDisabled();
        expect(screen.getByRole('button', { name: /^(Sync Now|Syncing...)$/ })).toBeDisabled();
      }
      if (operation === 'enable') expect(sendMessage).toHaveBeenCalledWith('setGistSyncEnabled', { enabled: true });
      await act(async () => {
        pending.resolve({ saved: false, error: 'Network unavailable' });
      });
      await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent('Network unavailable'));
      if (operation === 'setup') {
        expect(screen.getByLabelText('Personal Access Token')).toHaveValue('entered-pat');
        expect(screen.getByRole('button', { name: 'Cancel' })).toBeEnabled();
        expect(screen.getByRole('button', { name: 'Save' })).toBeEnabled();
      } else {
        expect(screen.getByRole('switch')).toBeEnabled();
        expect(screen.getByRole('button', { name: 'Edit' })).toBeEnabled();
        expect(screen.getByRole('button', { name: 'Sync Now' })).toBeEnabled();
      }
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
      const afterPull = async () => {
        pulled = true;
        await replaceLearningDocument(buildLearningDocument({ settings: { theme: 'light' } }));
        config = { pat: 'entered-pat', gistId: 'entered-gist', enabled: true };
        await storage.setItem(STORAGE_KEYS.gistConnection, config);
        return { saved: true, sync: { success: false, error: 'Status unavailable' } } as const;
      };
      messages
        .handle('setupGistSync', afterPull)
        .handle('setGistSyncEnabled', afterPull)
        .handle('triggerGistSync', async () => {
          await afterPull();
          if (operation === 'lost response') throw new Error('Disconnected after pull');
          return { success: false, error: 'Status unavailable' };
        });
      await open(operation === 'setup');
      if (operation === 'setup') enterCredentials();
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
      expect(test.queryClient.getQueryData(gistSyncQueryKeys.config)).toEqual(config);

      expect(test.queryClient.getQueryData(['cards'])).toEqual(['pulled card']);
      expect(test.queryClient.getQueryState(['settings'])?.isInvalidated).toBe(true);
      expect(screen.getByRole('switch')).toBeChecked();
      expect(screen.queryByLabelText('Personal Access Token')).not.toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Edit' })).toBeEnabled();
      unsubscribe();
    }
  );

  it('syncs manually while disabled and requires credentials when editing', async () => {
    messages.resolve('triggerGistSync', { success: false, error: 'Network unavailable' });
    await open(false);
    expect(screen.getByRole('button', { name: 'Sync Now' })).toBeEnabled();
    fireEvent.click(screen.getByRole('button', { name: 'Sync Now' }));
    await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent('Sync failed: Network unavailable'));
    messages.resolve('triggerGistSync', { success: true, action: 'no-change', timestamp: '2026-09-12' });
    fireEvent.click(screen.getByRole('button', { name: 'Sync Now' }));
    await waitFor(() => expect(screen.getByRole('status')).toHaveTextContent('Sync complete'));
    expect(sendMessage).toHaveBeenCalledWith('triggerGistSync');
    expect(screen.getByRole('switch')).not.toBeChecked();
    fireEvent.click(screen.getByRole('button', { name: 'Edit' }));
    fireEvent.change(screen.getByLabelText('Personal Access Token'), { target: { value: '' } });
    expect(screen.getByRole('button', { name: 'Save' })).toBeDisabled();
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
