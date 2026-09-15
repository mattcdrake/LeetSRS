/**
 * @vitest-environment happy-dom
 */
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fakeBrowser } from 'wxt/testing/fake-browser';
import { storage } from '#imports';
import { gistSyncQueryKeys } from '@/popup/queries/gist-sync';
import { background } from '@/shared/background-service';

import type { GistConnectionResult, GistSyncConfig } from '@/shared/models';
import { replaceLearningDocument, STORAGE_KEYS } from '@/shared/storage';
import { requireDefined } from '@/test/utils/assertions';
import { buildLearningDocument } from '@/test/utils/learning-document-mocks';
import { createServiceMock } from '@/test/utils/service-mocks';
import { createPopupTestWrapper } from '@/test/utils/test-wrapper';
import { GistSyncSection } from '../GistSyncSection';

vi.mock('@/shared/background-service', async (importOriginal) => {
  const { createMockBackground } = await import('@/test/utils/service-mocks');
  return {
    ...(await importOriginal<typeof import('@/shared/background-service')>()),
    background: createMockBackground(),
  };
});

const messages = createServiceMock(background);
let config: GistSyncConfig;
let test: ReturnType<typeof createPopupTestWrapper>;

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
    .resolve('setGistSyncEnabled', { saved: true });
  test = createPopupTestWrapper();
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
  it.each([false, true])('shows the saved connection after Save with delayed refresh=%s', async (delayed) => {
    const refresh = Promise.withResolvers<void>();
    config = { pat: '', gistId: null, enabled: false };
    messages.handle('setupGistSync', async (input) => {
      config = { pat: input.pat, gistId: input.mode === 'existing' ? input.gistId : 'created', enabled: true };
      if (delayed) {
        vi.spyOn(fakeBrowser.storage.sync, 'get').mockImplementationOnce(async () => {
          await refresh.promise;
          return { 'leetsrs:gistConnection': config };
        });
      }
      await storage.setItem(STORAGE_KEYS.gistConnection, config);
      return { saved: true };
    });
    await storage.setItem(STORAGE_KEYS.gistConnection, config);
    render(<GistSyncSection />, { wrapper: test.wrapper });
    await waitFor(() => expect(screen.getByLabelText('Personal Access Token')).toBeEnabled());
    expect(screen.getByLabelText('Personal Access Token')).not.toHaveFocus();
    expect(screen.queryByRole('button', { name: 'Edit' })).not.toBeInTheDocument();
    enterCredentials();
    fireEvent.change(screen.getByLabelText('Personal Access Token'), { target: { value: '' } });
    expect(screen.getByLabelText('Personal Access Token')).toHaveAttribute('aria-invalid', 'true');
    fireEvent.click(screen.getByRole('radio', { name: 'Create New Gist' }));
    // Happy DOM calls the overridden form.reset() on click; dispatch the browser's native reset event.
    fireEvent.reset(requireDefined(screen.getByRole('button', { name: 'Cancel' }).closest('form')));
    expect(screen.getByLabelText('Personal Access Token')).toHaveValue('');
    expect(screen.getByLabelText('Personal Access Token')).not.toHaveAttribute('aria-invalid', 'true');
    expect(screen.getByLabelText('Personal Access Token')).toHaveFocus();
    expect(screen.getByLabelText('Gist ID')).toHaveValue('');
    expect(screen.getByRole('radio', { name: 'Use existing Gist' })).toBeChecked();
    expect(screen.getByRole('button', { name: 'Save' })).toBeDisabled();
    expect(background.setupGistSync).not.toHaveBeenCalledWith(expect.anything());
    enterCredentials();
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));
    await waitFor(() => expect(screen.getByRole('status')).toHaveTextContent('Connection saved'));
    expect(screen.queryByLabelText('Personal Access Token')).not.toBeInTheDocument();
    await act(async () => refresh.resolve());
    expect(background.setupGistSync).toHaveBeenCalledWith({
      mode: 'existing',
      pat: 'entered-pat',
      gistId: 'entered-gist',
    });
    expect(await screen.findByRole('link', { name: 'Open backup Gist' })).toHaveAttribute(
      'href',
      'https://gist.github.com/entered-gist'
    );
    expect(screen.getByRole('switch', { name: 'Syncing' })).toBeChecked();
    expect(screen.queryByLabelText('Personal Access Token')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Edit' })).toHaveFocus();
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
      expect(screen.getByRole('link', { name: 'Open backup Gist' })).toBeInTheDocument();
      expect(screen.getByRole('switch')).toBeChecked();
      fireEvent.click(screen.getByRole('button', { name: 'Edit' }));
      expect(screen.getByLabelText('Personal Access Token')).toHaveValue('other-browser-pat');
      expect(screen.getByLabelText('Gist ID')).toHaveValue('other-browser-gist');
      expect(screen.getByRole('radio', { name: 'Use existing Gist' })).toBeChecked();
      expect(background.setupGistSync).not.toHaveBeenCalledWith(expect.anything());
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
    expect(screen.getByRole('link', { name: 'Open backup Gist' })).toBeInTheDocument();
  });

  it('can cancel drafts after browser sync removes the connection during editing', async () => {
    await open();
    enterCredentials();
    fireEvent.click(screen.getByRole('radio', { name: 'Create New Gist' }));
    config = { pat: '', gistId: null, enabled: false };
    await act(async () => {
      await storage.setItem(STORAGE_KEYS.gistConnection, config);
    });
    await waitFor(() => expect(test.queryClient.getQueryData(gistSyncQueryKeys.config)).toEqual(config));
    expect(screen.getByLabelText('Personal Access Token')).toHaveValue('entered-pat');
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(screen.getByLabelText('Personal Access Token')).toHaveValue('');
    expect(screen.getByLabelText('Personal Access Token')).toHaveFocus();
    expect(screen.getByLabelText('Gist ID')).toHaveValue('');
    expect(screen.getByRole('radio', { name: 'Use existing Gist' })).toBeChecked();
    expect(screen.getByRole('button', { name: 'Save' })).toBeDisabled();
    expect(background.setupGistSync).not.toHaveBeenCalledWith(expect.anything());
  });

  it.each(['setup failure', 'transport failure'])(
    'preserves drafts when storage events deliver browser-sync updates and after %s',
    async (failure) => {
      vi.useFakeTimers({ toFake: ['setInterval', 'clearInterval'] });
      messages.handle('setupGistSync', () => {
        if (failure === 'transport failure') throw new Error('Disconnected');
        return { saved: false, error: 'unavailable' };
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

  it.each(['setup', 'enable'] as const)(
    'locks conflicting controls while %s is pending and permits retry',
    async (operation) => {
      const pending = Promise.withResolvers<GistConnectionResult>();
      if (operation === 'setup') messages.resolve('setupGistSync', pending.promise);
      else messages.resolve('setGistSyncEnabled', pending.promise);
      await open(operation === 'setup');
      if (operation === 'setup') enterCredentials();
      fireEvent.click(
        operation === 'enable' ? screen.getByRole('switch') : screen.getByRole('button', { name: 'Save' })
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
      }
      if (operation === 'enable') expect(background.setGistSyncEnabled).toHaveBeenCalledWith(true);
      await act(async () => {
        pending.resolve({ saved: false, error: 'unavailable' });
      });
      await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent('continue learning'));
      if (operation === 'setup') {
        expect(screen.getByLabelText('Personal Access Token')).toHaveValue('entered-pat');
        expect(screen.getByRole('button', { name: 'Cancel' })).toBeEnabled();
        expect(screen.getByRole('button', { name: 'Save' })).toBeEnabled();
      } else {
        expect(screen.getByRole('switch')).toBeEnabled();
        expect(screen.getByRole('button', { name: 'Edit' })).toBeEnabled();
      }
    }
  );

  it('explains whole-dataset LWW, has no manual sync, and validates edited credentials', async () => {
    await open(false);
    expect(screen.getByText(/newest edit wins/i)).toHaveTextContent(/simultaneous changes/i);
    const disclosure = requireDefined(screen.getByText('How sync works').closest('details'));
    expect(disclosure).not.toHaveAttribute('open');
    fireEvent.click(screen.getByText('How sync works'));
    expect(disclosure).toHaveAttribute('open');
    expect(screen.getByText(/does not merge individual cards/i)).toBeVisible();
    expect(screen.queryByRole('button', { name: /sync now/i })).not.toBeInTheDocument();
    expect(screen.getByRole('switch', { name: 'Syncing' })).not.toBeChecked();
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
    await waitFor(() => expect(background.setupGistSync).toHaveBeenCalledWith(expect.any(Object)));
    view.unmount();
    await act(async () => {
      pending.resolve({ saved: true });
    });
    expect(complete).toHaveBeenCalledOnce();
  });
});
