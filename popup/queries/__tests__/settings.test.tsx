/**
 * @vitest-environment happy-dom
 */

import { act, renderHook, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fakeBrowser } from 'wxt/testing/fake-browser';
import { updateSettings } from '@/background/learning';
import { sendMessage } from '@/shared/messages';
import { readLearningDocument, replaceLearningDocument } from '@/shared/storage';
import { buildLearningDocument } from '@/test/utils/learning-document-mocks';
import { createMessageMock } from '@/test/utils/message-mocks';
import { createPopupTestWrapper } from '@/test/utils/test-wrapper';
import { useSettingsQuery, useUpdateSettingsMutation } from '../settings';

vi.mock('@/shared/messages', () => ({
  sendMessage: vi.fn(() => Promise.resolve(undefined)),
}));

describe('popup settings with the prepared document workflows', () => {
  beforeEach(async () => {
    fakeBrowser.reset();
    const messages = createMessageMock(vi.mocked(sendMessage));
    messages.reset().handle('updateSettings', ({ changes }) => updateSettings(changes));
    await replaceLearningDocument(buildLearningDocument());
  });

  afterEach(() => vi.restoreAllMocks());

  it('loads defaults, displays saved edits, and reloads replaced overrides through the existing commands', async () => {
    const { wrapper } = createPopupTestWrapper();
    const { result } = renderHook(() => ({ settings: useSettingsQuery(), update: useUpdateSettingsMutation() }), {
      wrapper,
    });
    await waitFor(() => expect(result.current?.settings.data.theme).toBe('system'));
    expect((await readLearningDocument())?.settings).toEqual({});

    await act(() => result.current.update.mutateAsync({ theme: 'dark' }));
    await waitFor(() => expect(result.current.settings.data.theme).toBe('dark'));
    expect((await readLearningDocument())?.settings).toEqual({ theme: 'dark' });

    await replaceLearningDocument(buildLearningDocument({ settings: { maxNewCardsPerDay: 0 } }));
    await waitFor(() => expect(result.current.settings.data.theme).toBe('system'));
    expect(result.current.settings.data.maxNewCardsPerDay).toBe(0);
  });

  it('reports a rejected save while retaining displayed and stored settings, then allows retry', async () => {
    const { wrapper } = createPopupTestWrapper();
    const { result } = renderHook(() => ({ settings: useSettingsQuery(), update: useUpdateSettingsMutation() }), {
      wrapper,
    });
    await waitFor(() => expect(result.current?.settings.data.theme).toBe('system'));
    const failure = new Error('Storage unavailable');
    vi.spyOn(fakeBrowser.storage.local, 'set').mockRejectedValueOnce(failure);

    await act(async () => {
      await expect(result.current.update.mutateAsync({ theme: 'dark' })).rejects.toBe(failure);
    });
    await waitFor(() => expect(result.current.update.error).toBe(failure));
    expect(result.current.settings.data.theme).toBe('system');
    expect((await readLearningDocument())?.settings).toEqual({});

    await act(() => result.current.update.mutateAsync({ theme: 'dark' }));
    await waitFor(() => expect(result.current.settings.data.theme).toBe('dark'));
    expect((await readLearningDocument())?.settings).toEqual({ theme: 'dark' });
  });
});
